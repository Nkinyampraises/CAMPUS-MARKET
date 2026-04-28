import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar';
import { Badge } from '@/app/components/ui/badge';
import {
  Award,
  CalendarDays,
  Camera,
  CheckCircle,
  Edit,
  GraduationCap,
  IdCard,
  Loader2,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';
import { fetchPublicCatalog, type NamedCatalogOption, resolveNamedCatalogLabel } from '@/lib/catalog';

const formatLabel = (value: string | undefined, fallback: string) => {
  if (!value) return fallback;

  return value
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

const getInitial = (value: string | undefined) => value?.trim().charAt(0).toUpperCase() || 'U';

export function Profile() {
  const { currentUser, isAuthenticated, updateProfile, accessToken } = useAuth();
  const navigate = useNavigate();
  const { userId } = useParams();
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingProfilePicture, setUploadingProfilePicture] = useState(false);
  type ProfileUser = NonNullable<typeof currentUser>;
  const [profileUser, setProfileUser] = useState<ProfileUser | null>(currentUser ?? null);
  const [universities, setUniversities] = useState<NamedCatalogOption[]>([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
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

  useEffect(() => {
    if (!currentUser) return;
    if (!userId || userId === currentUser.id) {
      setProfileUser(currentUser);
      setIsEditing(false);
      return;
    }

    setIsEditing(false);
    setIsLoadingProfile(true);

    const fetchProfile = async () => {
      try {
        const response = await fetch(`${API_URL}/users/${userId}`, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          toast.error(data.error || 'Unable to load profile');
          setProfileUser(null);
          return;
        }
        setProfileUser(data.user || null);
      } catch {
        toast.error('Unable to load profile');
        setProfileUser(null);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    fetchProfile();
  }, [userId, currentUser, accessToken]);

  useEffect(() => {
    if (!isAuthenticated || !currentUser) {
      navigate('/login');
    }
  }, [isAuthenticated, currentUser, navigate]);

  useEffect(() => {
    let mounted = true;
    const loadUniversities = async () => {
      try {
        const rows = await fetchPublicCatalog('universities');
        if (!mounted) return;
        setUniversities(rows);
      } catch {
        if (!mounted) return;
        setUniversities([]);
      }
    };
    loadUniversities();
    return () => {
      mounted = false;
    };
  }, []);

  if (!isAuthenticated || !currentUser) {
    return null;
  }

  const isOwnProfile = !userId || userId === currentUser.id;
  const viewedUser = isOwnProfile ? currentUser : profileUser;

  if (isLoadingProfile && !isOwnProfile) {
    return (
      <div className="min-h-screen bg-[#f5f7f6] py-8">
        <div className="mx-auto w-full max-w-[1220px] px-4 lg:px-6">
          <Card className="rounded-2xl border border-[#d3e3dc] bg-white p-8 text-center shadow-sm">
            <div className="inline-flex items-center gap-2 text-[#0f6f58]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading profile...
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (!viewedUser) {
    return (
      <div className="min-h-screen bg-[#f5f7f6] py-8">
        <div className="mx-auto w-full max-w-[1220px] px-4 lg:px-6">
          <Card className="rounded-2xl border border-[#d3e3dc] bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-[#4f6b62]">Profile not available.</p>
          </Card>
        </div>
      </div>
    );
  }

  const universityName = resolveNamedCatalogLabel(
    universities,
    viewedUser.university,
    viewedUser.university || 'University not specified',
  );

  const handleSaveProfile = async () => {
    if (!isOwnProfile) return;
    const result = await updateProfile({
      name: formData.name,
      phone: formData.phone,
      studentId: formData.studentId,
      profilePicture: formData.profilePicture,
    });
    
    if (result.success) {
      setIsEditing(false);
      toast.success('Profile updated successfully!');
    } else {
      toast.error(result.error || 'Failed to update profile');
    }
  };

  const resetForm = () => {
    setFormData({
      name: currentUser.name || '',
      phone: currentUser.phone || '',
      studentId: currentUser.studentId || '',
      profilePicture: currentUser.profilePicture || '',
    });
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

  const displayName = isEditing ? formData.name || currentUser.name : viewedUser.name;
  const displayProfilePicture =
    isEditing ? formData.profilePicture || currentUser.profilePicture || '' : viewedUser.profilePicture || '';
  const joinedLabel = viewedUser.createdAt
    ? new Date(viewedUser.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : 'Recently joined';
  const reviewAverage = Number.isFinite(viewedUser.rating) ? viewedUser.rating.toFixed(1) : '0.0';
  const visibilityLabel =
    viewedUser.privacyOptions?.profileVisibility === 'private' ? 'Private Profile' : 'Public Profile';
  const subscriptionLabel = formatLabel(viewedUser.subscriptionStatus, 'Trial Access');
  const completionItems = [
    { label: 'Profile photo added', complete: Boolean((displayProfilePicture || '').trim()) },
    { label: 'Phone number added', complete: Boolean((viewedUser.phone || '').trim()) },
    { label: 'Student ID added', complete: Boolean((viewedUser.studentId || '').trim()) },
    { label: 'University linked', complete: Boolean(viewedUser.university) },
  ];
  const completionPercent = Math.round(
    (completionItems.filter((item) => item.complete).length / completionItems.length) * 100,
  );
  const summaryCards = [
    {
      label: 'Average Rating',
      value: reviewAverage,
      caption: `${viewedUser.reviewCount} student review${viewedUser.reviewCount === 1 ? '' : 's'}`,
      icon: Star,
      accent: 'from-amber-400 to-orange-500',
    },
    {
      label: 'Account Type',
      value: formatLabel(viewedUser.userType, 'Buyer'),
      caption: viewedUser.role === 'admin' ? 'Admin access enabled' : 'Campus marketplace member',
      icon: ShieldCheck,
      accent: 'from-emerald-500 to-teal-500',
    },
    {
      label: 'Subscription',
      value: subscriptionLabel,
      caption: viewedUser.subscriptionEndDate
        ? `Ends ${new Date(viewedUser.subscriptionEndDate).toLocaleDateString()}`
        : 'Trial or default access',
      icon: Award,
      accent: 'from-sky-500 to-cyan-500',
    },
  ];
  const heroMeta = [
    { label: 'Email', value: viewedUser.email, icon: Mail },
    { label: 'Phone', value: viewedUser.phone || 'Add a phone number', icon: Phone },
    { label: 'Member Since', value: joinedLabel, icon: CalendarDays },
    { label: 'Student ID', value: viewedUser.studentId || 'Add your student ID', icon: IdCard },
  ];
  const detailCards = [
    { label: 'Full name', value: viewedUser.name, icon: User },
    { label: 'Email address', value: viewedUser.email, icon: Mail },
    { label: 'Phone number', value: viewedUser.phone || 'Not added yet', icon: Phone },
    { label: 'University', value: universityName, icon: GraduationCap },
    { label: 'Student ID', value: viewedUser.studentId || 'Not added yet', icon: IdCard },
    { label: 'Member since', value: joinedLabel, icon: CalendarDays },
  ];
  const trustItems = [
    {
      title: 'Verified student',
      description: viewedUser.isVerified
        ? 'Your campus identity is confirmed and visible on your profile.'
        : 'Complete account verification to strengthen trust faster.',
      active: viewedUser.isVerified,
      icon: CheckCircle,
    },
    {
      title: 'Trading access',
      description: viewedUser.isBanned
        ? 'This account is currently restricted from marketplace activity.'
        : viewedUser.isApproved
          ? 'You are approved to trade across the marketplace.'
          : 'Approval is still pending review.',
      active: viewedUser.isApproved && !viewedUser.isBanned,
      icon: ShieldCheck,
    },
    {
      title: 'Marketplace identity',
      description:
        viewedUser.userType === 'seller'
          ? 'You are set up to list items, handle orders, and grow your reputation.'
          : 'You are ready to browse, save favorites, and buy from trusted students.',
      active: true,
      icon: Sparkles,
    },
  ];
  const nextSteps = completionItems.filter((item) => !item.complete);

  return (
    <div className="min-h-screen bg-[#f5f7f6] py-8">
      <div className="mx-auto flex w-full max-w-[1220px] flex-col gap-6 px-4 lg:px-6">
        <section className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-[#d3e3dc] bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-col gap-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                    <div className="relative">
                      <Avatar className="h-28 w-28 rounded-3xl border border-[#c4ded3] ring-4 ring-[#e6f4ef] shadow-sm">
                        {displayProfilePicture ? <AvatarImage src={displayProfilePicture} alt={displayName} /> : null}
                        <AvatarFallback className="bg-[#dff2ea] text-4xl font-semibold text-[#0f5f4c]">
                          {getInitial(displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-2 -right-2 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#c4ded3] bg-white text-[#0f5f4c] shadow-sm">
                        <Camera className="h-4 w-4" />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="inline-flex items-center gap-2 rounded-full bg-[#e8f5ef] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#0f6f58]">
                        <Sparkles className="h-3.5 w-3.5" />
                        Profile Studio
                      </div>
                      <div>
                        <h1 className="text-3xl font-semibold leading-tight text-[#0b1f1a] sm:text-4xl">
                          {displayName}
                        </h1>
                        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#4f6b62]">
                          <span className="inline-flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-[#0f6f58]" />
                            {universityName}
                          </span>
                          <span className="inline-flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-[#0f6f58]" />
                          {formatLabel(viewedUser.userType, 'Buyer')} account
                        </span>
                      </p>
                    </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge className="rounded-full border-0 bg-[#e8f5ef] px-3 py-1 text-[#0f6f58]">
                          {viewedUser.isVerified ? 'Verified Student' : 'Verification Pending'}
                        </Badge>
                        <Badge className="rounded-full border-0 bg-[#ecf4f1] px-3 py-1 text-[#365f53]">
                          {viewedUser.isBanned
                            ? 'Restricted Account'
                            : viewedUser.isApproved
                              ? 'Approved to Trade'
                              : 'Approval Pending'}
                        </Badge>
                        <Badge className="rounded-full border-0 bg-[#fff4df] px-3 py-1 text-[#8a6822]">
                          {visibilityLabel}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {isOwnProfile && (
                    <div className="flex flex-wrap gap-3">
                      <Button
                        variant={isEditing ? 'outline' : 'default'}
                        className={
                          isEditing
                          ? 'rounded-full border-[#bdd8cd] bg-white px-5 text-[#124a3b] hover:bg-[#f3faf7]'
                          : 'rounded-full bg-[#1FAF9A] px-5 text-white hover:bg-[#27b9a6]'
                        }
                        onClick={() => {
                          if (isEditing) {
                            setIsEditing(false);
                            resetForm();
                            return;
                          }

                          setIsEditing(true);
                        }}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        {isEditing ? 'Cancel editing' : 'Edit profile'}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {heroMeta.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-[#d3e3dc] bg-[#f9fcfb] p-4 shadow-sm"
                    >
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1FAF9A] text-white">
                        <item.icon className="h-4 w-4" />
                      </div>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.15em] text-[#5f7a71]">
                        {item.label}
                      </p>
                      <p className="mt-1 text-sm font-medium text-[#0f2c24]">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-[#d3e3dc] bg-white p-5 shadow-sm"
              >
                <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${card.accent} text-white shadow-lg`}>
                  <card.icon className="h-5 w-5" />
                </div>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.15em] text-[#5f7a71]">
                  {card.label}
                </p>
                <p className="mt-1 text-2xl font-semibold text-[#0f2c24]">{card.value}</p>
                <p className="mt-1 text-sm text-[#4f6b62]">{card.caption}</p>
              </div>
            ))}

            <div className="rounded-2xl border border-[#1FAF9A] bg-[#1FAF9A] p-5 text-white shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#bde9db]">
                    Profile Strength
                  </p>
                  <p className="mt-1 text-3xl font-semibold">{completionPercent}%</p>
                </div>
                <Sparkles className="h-6 w-6 text-[#bde9db]" />
              </div>
              <div className="mt-4 h-2.5 rounded-full bg-white/20">
                <div className="h-2.5 rounded-full bg-[#7ce6c8]" style={{ width: `${completionPercent}%` }} />
              </div>
              <div className="mt-4 space-y-2 text-sm text-[#daf1e9]">
                {completionItems.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3">
                    <span>{item.label}</span>
                    <span className={item.complete ? 'text-[#9af2d7]' : 'text-[#8fd1bf]'}>
                      {item.complete ? 'Done' : 'Missing'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#0f6f58]">
              Account View
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[#0b1f1a] sm:text-3xl">
              Profile details
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-[#4f6b62]">
              Keep your profile sharp, trustworthy, and easy for other students to understand at a glance.
            </p>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
              <Card className="rounded-2xl border border-[#d3e3dc] bg-white shadow-sm">
                <CardHeader className="space-y-3">
                  <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[#e8f5ef] px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#0f6f58]">
                    <User className="h-3.5 w-3.5" />
                    Personal Profile
                  </div>
                  <CardTitle className="text-2xl font-semibold text-[#0b1f1a]">
                    {isEditing ? 'Polish your public profile' : 'The details students will see first'}
                  </CardTitle>
                  <CardDescription className="max-w-2xl text-sm text-[#4f6b62]">
                    {isEditing
                      ? 'Update the essentials that make you look credible, clear, and easy to trust.'
                      : 'These details shape how buyers and sellers experience your account across the marketplace.'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isEditing ? (
                    <div className="space-y-5">
                      <div className="rounded-2xl border border-[#cfe4db] bg-[#f2faf6] p-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                          <Avatar className="h-24 w-24 rounded-2xl border border-[#c4ded3] ring-4 ring-[#e6f4ef]">
                            {displayProfilePicture ? <AvatarImage src={displayProfilePicture} alt={displayName} /> : null}
                            <AvatarFallback className="bg-[#dff2ea] text-3xl font-semibold text-[#0f5f4c]">
                              {getInitial(displayName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 space-y-2">
                            <Label htmlFor="profile-picture-upload">Profile photo</Label>
                            <Input
                              id="profile-picture-upload"
                              type="file"
                              accept="image/*"
                              disabled={uploadingProfilePicture}
                              onChange={(e) => handleProfilePictureUpload(e.target.files?.[0] || null)}
                              className="border-[#cfe0d8] bg-white"
                            />
                            <p className="text-xs text-[#5f7a71]">
                              JPG, PNG, or WEBP up to 5MB. A clear photo helps your account feel more trustworthy.
                            </p>
                            {uploadingProfilePicture && (
                              <p className="inline-flex items-center gap-2 text-xs font-medium text-[#0f6f58]">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Uploading profile picture...
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="name">Full name</Label>
                          <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                            className="border-[#cfe0d8] bg-white"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone number</Label>
                          <Input
                            id="phone"
                            value={formData.phone}
                            onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                            className="border-[#cfe0d8] bg-white"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="studentId">Student ID</Label>
                          <Input
                            id="studentId"
                            value={formData.studentId}
                            onChange={(e) => setFormData((prev) => ({ ...prev, studentId: e.target.value }))}
                            className="border-[#cfe0d8] bg-white"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Email address</Label>
                          <Input value={currentUser.email} disabled className="bg-[#eef3f1]" />
                          <p className="text-xs text-[#5f7a71]">Email cannot be changed here.</p>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <Label>University</Label>
                          <Input value={universityName} disabled className="bg-[#eef3f1]" />
                          <p className="text-xs text-[#5f7a71]">
                            Your university stays fixed so your campus identity remains consistent.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                        <Button
                          onClick={handleSaveProfile}
                          disabled={uploadingProfilePicture}
                          className="flex-1 rounded-full bg-[#1FAF9A] text-white hover:bg-[#27b9a6]"
                        >
                          Save changes
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsEditing(false);
                            resetForm();
                          }}
                          className="flex-1 rounded-full border-[#c2d9cf] text-[#124a3b] hover:bg-[#f3faf7]"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {detailCards.map((item) => (
                        <div
                          key={item.label}
                          className="rounded-2xl border border-[#d3e3dc] bg-[#f9fcfb] p-4"
                        >
                          <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#0f6f58] shadow-sm">
                            <item.icon className="h-4 w-4" />
                          </div>
                          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.15em] text-[#5f7a71]">
                            {item.label}
                          </p>
                          <p className="mt-1 text-sm font-medium text-[#0f2c24]">
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card className="rounded-[2rem] border border-white/70 bg-white/88 shadow-[0_30px_90px_-55px_rgba(14,165,233,0.45)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/70">
                  <CardHeader className="space-y-3">
                    <div className="inline-flex w-fit items-center gap-2 rounded-full bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-sky-700 dark:bg-sky-400/15 dark:text-sky-200">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Trust Markers
                    </div>
                    <CardTitle className="text-xl font-serif text-slate-950 dark:text-white">
                      Signals that build confidence
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {trustItems.map((item) => (
                      <div
                        key={item.title}
                        className="flex gap-4 rounded-[1.4rem] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60"
                      >
                        <div className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${item.active ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}>
                          <item.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.description}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="rounded-[2rem] border border-white/70 bg-white/88 shadow-[0_30px_90px_-55px_rgba(245,158,11,0.4)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/70">
                  <CardHeader className="space-y-3">
                    <div className="inline-flex w-fit items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-amber-700 dark:bg-amber-400/15 dark:text-amber-200">
                      <Award className="h-3.5 w-3.5" />
                      Visibility
                    </div>
                    <CardTitle className="text-xl font-serif text-slate-950 dark:text-white">
                      Marketplace snapshot
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-[1.4rem] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                        Profile visibility
                      </p>
                      <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">{visibilityLabel}</p>
                    </div>
                    <div className="rounded-[1.4rem] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                        Current plan
                      </p>
                      <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">{subscriptionLabel}</p>
                    </div>
                    <div className="rounded-[1.4rem] border border-dashed border-emerald-200/80 bg-emerald-50/70 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {nextSteps.length > 0 ? 'Next best improvements' : 'Your profile is in strong shape'}
                      </p>
                      {nextSteps.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {nextSteps.map((item) => (
                            <div key={item.label} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                              <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                              {item.label}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                          You already have the key ingredients for a trustworthy campus profile.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
          </div>
        </section>
      </div>
    </div>
  );
}
