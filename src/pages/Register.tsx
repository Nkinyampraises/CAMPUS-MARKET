import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { PasswordInput } from '@/app/components/ui/password-input';
import { Label } from '@/app/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar';
import { ShoppingBag, Loader2, ShoppingCart, Store, Upload } from 'lucide-react';
import { universities } from '@/data/mockData';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';

const registerHeroImage =
  'https://images.pexels.com/photos/1454360/pexels-photo-1454360.jpeg?cs=srgb&dl=pexels-olly-1454360.jpg&fm=jpg';

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
  const [confirmationLink, setConfirmationLink] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setConfirmationLink('');

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
        toast.success(
          result.message || 'Account created successfully. Check your email to confirm your account before logging in.',
        );
        if (result.confirmationLink) {
          setConfirmationLink(result.confirmationLink);
        } else {
          setTimeout(() => {
            navigate('/login');
          }, 3000);
        }
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
    <div className="min-h-[calc(100vh-4rem)] bg-[#f5f5f5] py-8">
      <div className="mx-auto grid w-full max-w-[1400px] gap-6 px-4 lg:grid-cols-[0.95fr_1.05fr]">
        <aside className="relative hidden overflow-hidden rounded-3xl lg:flex lg:min-h-[860px] lg:flex-col lg:justify-between">
          <img src={registerHeroImage} alt="Student preparing to join campus marketplace" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,89,66,0.78)_0%,rgba(6,80,59,0.84)_38%,rgba(4,58,43,0.9)_100%)]" />

          <div className="relative z-10 p-10 text-white xl:p-12">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <h2 className="mt-6 max-w-md text-5xl font-bold leading-[1.06]">
              Start Selling and Buying with Confidence.
            </h2>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-emerald-50/90">
              Join UNITRADE and connect with verified students across universities. Create your account once and trade safely.
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-2 gap-4 border-t border-white/20 p-10 text-white xl:p-12">
            <div>
              <p className="text-3xl font-bold">15k+</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-emerald-100/80">Student members</p>
            </div>
            <div>
              <p className="text-3xl font-bold">24+</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-emerald-100/80">Partner campuses</p>
            </div>
          </div>
        </aside>

        <Card className="rounded-3xl border border-[#d3e3dc] bg-white shadow-sm">
          <CardHeader className="pb-2">
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[#e8f5ef] px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-[#0f6f58]">
              Create Account
            </div>
            <CardTitle className="mt-3 text-3xl font-semibold text-[#0b1f1a] sm:text-4xl">Join UNITRADE</CardTitle>
            <CardDescription className="text-sm text-[#4f6b62]">
              Fill in your details to create a verified student marketplace account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {confirmationLink && (
                <Alert className="border-[#c9e1d6] bg-[#f1faf6] text-[#0f5f4c]">
                  <AlertDescription>
                    Email delivery is unavailable right now. Use this confirmation link:{' '}
                    <a href={confirmationLink} className="font-semibold text-[#0f6f58] underline break-all">
                      {confirmationLink}
                    </a>
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Amina Ngoma"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    className="border-[#cfe0d8] bg-white"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">University Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@student.ub.cm"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="border-[#cfe0d8] bg-white"
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
                    className="border-[#cfe0d8] bg-white"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="university">University</Label>
                  <Select value={formData.university} onValueChange={(value) => handleChange('university', value)} required>
                    <SelectTrigger className="border-[#cfe0d8] bg-white">
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

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="studentId">Student ID (Optional)</Label>
                  <Input
                    id="studentId"
                    type="text"
                    placeholder="UB2024001"
                    value={formData.studentId}
                    onChange={(e) => handleChange('studentId', e.target.value)}
                    className="border-[#cfe0d8] bg-white"
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-[#d3e3dc] bg-[#f9fcfb] p-4">
                <Label>Profile Picture (Optional)</Label>
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border border-[#cfe0d8]">
                    {formData.profilePicture ? (
                      <AvatarImage src={formData.profilePicture} alt={formData.name || 'Profile'} />
                    ) : null}
                    <AvatarFallback className="bg-[#dff2ea] text-[#0f6f58]">
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
                      className="border-[#cfe0d8] bg-white"
                    />
                    <p className="mt-1 text-xs text-[#5f7a71]">JPG, PNG, or WEBP up to 5MB</p>
                  </div>
                </div>
                {uploadingProfilePicture && (
                  <p className="inline-flex items-center gap-1 text-xs text-[#0f6f58]">
                    <Upload className="h-3 w-3" />
                    Uploading profile picture...
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>I want to:</Label>
                <RadioGroup value={formData.userType} onValueChange={(value) => handleChange('userType', value)} className="grid gap-3 sm:grid-cols-2">
                  <Label htmlFor="buyer" className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#cfe0d8] bg-[#f7fcfa] p-3">
                    <RadioGroupItem value="buyer" id="buyer" className="mt-0.5" />
                    <div>
                      <p className="flex items-center gap-2 font-medium text-[#0f2c24]">
                        <ShoppingCart className="h-4 w-4 text-[#0f6f58]" />
                        Buy Items
                      </p>
                      <p className="text-xs text-[#5f7a71]">Browse and purchase from sellers</p>
                    </div>
                  </Label>
                  <Label htmlFor="seller" className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#cfe0d8] bg-[#f7fcfa] p-3">
                    <RadioGroupItem value="seller" id="seller" className="mt-0.5" />
                    <div>
                      <p className="flex items-center gap-2 font-medium text-[#0f2c24]">
                        <Store className="h-4 w-4 text-[#0f6f58]" />
                        Sell Items
                      </p>
                      <p className="text-xs text-[#5f7a71]">List products and serve student buyers</p>
                    </div>
                  </Label>
                </RadioGroup>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <PasswordInput
                    id="password"
                    placeholder="Min. 6 characters"
                    value={formData.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    className="border-[#cfe0d8] bg-white"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <PasswordInput
                    id="confirmPassword"
                    placeholder="Re-enter password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleChange('confirmPassword', e.target.value)}
                    className="border-[#cfe0d8] bg-white"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="h-11 w-full bg-[#0f6f58] text-white hover:bg-[#0d5f4b]" disabled={loading}>
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
          <CardFooter className="flex justify-center border-t border-[#ebf2ef] pt-5">
            <p className="text-sm text-[#5f7a71]">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-[#0f6f58] hover:underline">
                Login
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

