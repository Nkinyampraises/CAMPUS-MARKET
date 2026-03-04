import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar';
import { ShoppingBag, Loader2, ShoppingCart, Store, Upload } from 'lucide-react';
import { universities } from '@/data/mockData';
import { toast } from 'sonner';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8002'}/make-server-50b25a4f`;

export function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    university: '',
    studentId: '',
    userType: 'buyer' as 'buyer' | 'seller',
    profilePicture: '',
  });
  const [loading, setLoading] = useState(false);
  const [uploadingProfilePicture, setUploadingProfilePicture] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (!formData.university) {
      setError('Please select your university');
      return;
    }

    setLoading(true);

    try {
      const result = await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        university: formData.university,
        studentId: formData.studentId,
        userType: formData.userType,
        profilePicture: formData.profilePicture,
      });

      if (result.success) {
        toast.success('Account created! Please wait for admin approval before logging in.');
        // Show success message instead of navigating
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        setError(result.error || 'Email already exists or registration failed');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
        body: uploadFormData,
      });

      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Failed to upload profile picture');
        return;
      }

      handleChange('profilePicture', data.url || '');
      toast.success('Profile picture uploaded');
    } catch (uploadError) {
      toast.error('Failed to upload profile picture');
    } finally {
      setUploadingProfilePicture(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <ShoppingBag className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <CardTitle>Create Account</CardTitle>
          <CardDescription>Join CampusMarket - Student Marketplace</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Amina Ngoma"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
              />
            </div>

            <div className="space-y-3">
              <Label>Profile Picture (Optional)</Label>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  {formData.profilePicture ? (
                    <AvatarImage src={formData.profilePicture} alt={formData.name || 'Profile'} />
                  ) : null}
                  <AvatarFallback className="bg-green-100 text-green-700">
                    {(formData.name || 'U').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <Input
                    id="profilePicture"
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
                  <Upload className="h-3 w-3" />
                  Uploading profile picture...
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">University Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@student.ub.cm"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+237 670 123 456"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="university">University</Label>
              <Select onValueChange={(value) => handleChange('university', value)} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select your university" />
                </SelectTrigger>
                <SelectContent>
                  {universities.map((uni) => (
                    <SelectItem key={uni.id} value={uni.id}>
                      {uni.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="studentId">Student ID (Optional)</Label>
              <Input
                id="studentId"
                type="text"
                placeholder="UB2024001"
                value={formData.studentId}
                onChange={(e) => handleChange('studentId', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>I want to:</Label>
              <RadioGroup
                value={formData.userType}
                onValueChange={(value) => handleChange('userType', value)}
              >
                <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted">
                  <RadioGroupItem value="buyer" id="buyer" />
                  <Label htmlFor="buyer" className="flex-1 cursor-pointer flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="font-medium">Buy Items</p>
                      <p className="text-xs text-muted-foreground">Browse and purchase from sellers</p>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted">
                  <RadioGroupItem value="seller" id="seller" />
                  <Label htmlFor="seller" className="flex-1 cursor-pointer flex items-center gap-2">
                    <Store className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="font-medium">Sell Items</p>
                      <p className="text-xs text-muted-foreground">List and sell items to buyers</p>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Min. 6 characters"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter password"
                value={formData.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                required
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                'Sign Up'
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="text-green-600 hover:underline">
              Login
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
