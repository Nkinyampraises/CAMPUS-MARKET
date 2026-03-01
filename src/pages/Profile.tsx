import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar';
import { Badge } from '@/app/components/ui/badge';
import { Separator } from '@/app/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Star, 
  Award,
  Edit,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { getUniversityName } from '@/data/mockData';
import { toast } from 'sonner';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8002'}/make-server-50b25a4f`;

export function Profile() {
  const { currentUser, isAuthenticated, updateProfile, accessToken } = useAuth();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingProfilePicture, setUploadingProfilePicture] = useState(false);
  const [userReviews, setUserReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [formData, setFormData] = useState({
    name: currentUser?.name || '',
    phone: currentUser?.phone || '',
    studentId: currentUser?.studentId || '',
    profilePicture: currentUser?.profilePicture || '',
  });

  useEffect(() => {
    if (!currentUser) return;
    setFormData({
      name: currentUser.name || '',
      phone: currentUser.phone || '',
      studentId: currentUser.studentId || '',
      profilePicture: currentUser.profilePicture || '',
    });
  }, [currentUser]);

  if (!isAuthenticated || !currentUser) {
    navigate('/login');
    return null;
  }

  const universityName = getUniversityName(currentUser.university);

  useEffect(() => {
    const fetchUserReviews = async () => {
      if (!currentUser?.id) return;
      setLoadingReviews(true);
      try {
        const reviewsRes = await fetch(`${API_URL}/reviews/${currentUser.id}`);
        if (!reviewsRes.ok) {
          setUserReviews([]);
          return;
        }
        const reviewsData = await reviewsRes.json().catch(() => ({}));
        const reviewList = Array.isArray(reviewsData?.reviews) ? reviewsData.reviews : [];

        const reviewerIds = Array.from(
          new Set(
            reviewList
              .map((review: any) => review?.reviewerId)
              .filter((id: any) => typeof id === 'string' && id.length > 0),
          ),
        );

        const reviewerMap = new Map<string, any>();
        await Promise.all(
          reviewerIds.map(async (reviewerId) => {
            try {
              const profileRes = await fetch(`${API_URL}/users/${reviewerId}`, {
                headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
              });
              if (!profileRes.ok) return;
              const profileData = await profileRes.json().catch(() => ({}));
              if (profileData?.user) {
                reviewerMap.set(reviewerId, profileData.user);
              }
            } catch (_error) {
              // Ignore single-profile failures.
            }
          }),
        );

        const enrichedReviews = reviewList.map((review: any) => {
          const reviewer = reviewerMap.get(review?.reviewerId);
          return {
            ...review,
            reviewerName: reviewer?.name || 'Student',
            reviewerProfilePicture: reviewer?.profilePicture || reviewer?.avatar || '',
          };
        });
        setUserReviews(enrichedReviews);
      } catch (_error) {
        setUserReviews([]);
      } finally {
        setLoadingReviews(false);
      }
    };

    fetchUserReviews();
  }, [currentUser?.id, accessToken]);

  const handleSaveProfile = async () => {
    const success = await updateProfile({
      name: formData.name,
      phone: formData.phone,
      studentId: formData.studentId,
      profilePicture: formData.profilePicture,
    });
    
    if (success) {
      setIsEditing(false);
      toast.success('Profile updated successfully!');
    } else {
      toast.error('Failed to update profile');
    }
  };

  const handleProfilePictureUpload = async (file: File | null) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    if (file.size > 5242880) {
      toast.error('Profile image must be less than 5MB');
      return;
    }

    setUploadingProfilePicture(true);

    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('type', 'profile');

      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        body: uploadFormData,
      });

      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Failed to upload profile picture');
        return;
      }

      setFormData((prev) => ({ ...prev, profilePicture: data.url || '' }));
      toast.success('Profile picture uploaded');
    } catch (uploadError) {
      toast.error('Failed to upload profile picture');
    } finally {
      setUploadingProfilePicture(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">My Profile</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center mb-6">
                  <Avatar className="h-24 w-24 mx-auto mb-4">
                    {currentUser.profilePicture ? (
                      <AvatarImage src={currentUser.profilePicture} alt={currentUser.name} />
                    ) : null}
                    <AvatarFallback className="bg-green-100 text-green-600 text-2xl">
                      {currentUser.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <h2 className="text-xl font-bold mb-1">{currentUser.name}</h2>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    {currentUser.isVerified && (
                      <Badge variant="secondary" className="text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Verified Student
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-center gap-1 text-sm">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold">{currentUser.rating}</span>
                    <span className="text-muted-foreground">
                      ({currentUser.reviewCount} reviews)
                    </span>
                  </div>
                </div>

                <Separator className="my-4" />

                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    {currentUser.email}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    {currentUser.phone}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {universityName}
                  </div>
                  {currentUser.studentId && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Award className="h-4 w-4" />
                      ID: {currentUser.studentId}
                    </div>
                  )}
                </div>

                <Button 
                  className="w-full mt-6"
                  variant="outline"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  {isEditing ? 'Cancel' : 'Edit Profile'}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Profile Details */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="info" className="space-y-4">
              <TabsList>
                <TabsTrigger value="info">Personal Info</TabsTrigger>
                <TabsTrigger value="reviews">Reviews ({userReviews.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="info">
                <Card>
                  <CardHeader>
                    <CardTitle>Personal Information</CardTitle>
                    <CardDescription>
                      {isEditing ? 'Update your profile information' : 'Your account details'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isEditing ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Profile Picture</Label>
                          <div className="flex items-center gap-4">
                            <Avatar className="h-16 w-16">
                              {formData.profilePicture ? (
                                <AvatarImage src={formData.profilePicture} alt={formData.name || currentUser.name} />
                              ) : null}
                              <AvatarFallback className="bg-green-100 text-green-700">
                                {(formData.name || currentUser.name).charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <Input
                                type="file"
                                accept="image/*"
                                disabled={uploadingProfilePicture}
                                onChange={(e) => handleProfilePictureUpload(e.target.files?.[0] || null)}
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                JPG, PNG, or WEBP up to 5MB
                              </p>
                            </div>
                          </div>
                          {uploadingProfilePicture && (
                            <p className="text-xs text-blue-600 flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Uploading profile picture...
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="name">Full Name</Label>
                          <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone Number</Label>
                          <Input
                            id="phone"
                            value={formData.phone}
                            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="studentId">Student ID</Label>
                          <Input
                            id="studentId"
                            value={formData.studentId}
                            onChange={(e) => setFormData(prev => ({ ...prev, studentId: e.target.value }))}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input value={currentUser.email} disabled />
                          <p className="text-xs text-muted-foreground">
                            Email cannot be changed
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label>University</Label>
                          <Input value={universityName} disabled />
                          <p className="text-xs text-muted-foreground">
                            University cannot be changed
                          </p>
                        </div>

                        <div className="flex gap-2 pt-4">
                          <Button 
                            onClick={handleSaveProfile}
                            className="flex-1 bg-green-600 hover:bg-green-700"
                          >
                            Save Changes
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => {
                              setIsEditing(false);
                              setFormData({
                                name: currentUser.name,
                                phone: currentUser.phone,
                                studentId: currentUser.studentId || '',
                                profilePicture: currentUser.profilePicture || '',
                              });
                            }}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <Label className="text-muted-foreground">Full Name</Label>
                          <p className="font-medium">{currentUser.name}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Email</Label>
                          <p className="font-medium">{currentUser.email}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Phone</Label>
                          <p className="font-medium">{currentUser.phone}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">University</Label>
                          <p className="font-medium">{universityName}</p>
                        </div>
                        {currentUser.studentId && (
                          <div>
                            <Label className="text-muted-foreground">Student ID</Label>
                            <p className="font-medium">{currentUser.studentId}</p>
                          </div>
                        )}
                        <div>
                          <Label className="text-muted-foreground">Account Status</Label>
                          <div className="flex items-center gap-2 mt-1">
                            {currentUser.isVerified ? (
                              <Badge variant="secondary" className="bg-green-100 text-green-700">
                                Verified
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Not Verified</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="reviews">
                <Card>
                  <CardHeader>
                    <CardTitle>Reviews & Ratings</CardTitle>
                    <CardDescription>
                      What other students say about you
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loadingReviews ? (
                      <div className="text-center py-8">
                        <Loader2 className="h-8 w-8 text-muted-foreground mx-auto mb-3 animate-spin" />
                        <p className="text-muted-foreground">Loading reviews...</p>
                      </div>
                    ) : userReviews.length > 0 ? (
                      <div className="space-y-4">
                        {userReviews.map((review) => {
                          return (
                            <div key={review.id} className="border rounded-lg p-4">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-8 w-8">
                                    {review.reviewerProfilePicture ? (
                                      <AvatarImage src={review.reviewerProfilePicture} alt={review.reviewerName} />
                                    ) : null}
                                    <AvatarFallback className="bg-green-100 text-green-600 text-xs">
                                      {(review.reviewerName || 'S').charAt(0)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium text-sm">{review.reviewerName}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {new Date(review.timestamp).toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  {[...Array(5)].map((_, i) => (
                                    <Star
                                      key={i}
                                      className={`h-4 w-4 ${
                                        i < review.rating
                                          ? 'fill-yellow-400 text-yellow-400'
                                          : 'text-gray-300'
                                      }`}
                                    />
                                  ))}
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground">{review.comment}</p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No reviews yet</p>
                        <p className="text-sm text-muted-foreground mt-2">
                          Complete transactions to receive reviews
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
