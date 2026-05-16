import { useState, useEffect } from 'react';
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
import { ShoppingBag, Loader2, ShoppingCart, Store, Upload, Users, ListChecks, Star, TrendingUp, ArrowRight } from 'lucide-react';
import { universities } from '@/data/mockData';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

const registerHeroImage =
  'https://images.pexels.com/photos/1454360/pexels-photo-1454360.jpeg?cs=srgb&dl=pexels-olly-1454360.jpg&fm=jpg';

export function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const { t } = useLanguage();

  const [platformStats, setPlatformStats] = useState({ students: 0, listings: 0, deals: 0, rating: '4.8' });

  useEffect(() => {
    fetch(`${API_URL}/public-stats`)
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.error) setPlatformStats(data);
      })
      .catch(() => {});
  }, []);
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

  const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k+` : n > 0 ? `${n}+` : '—';
  const stats = [
    { icon: <Users className="h-5 w-5 text-[#05B43D]" />, value: fmt(platformStats.students), label: t('ui.students', 'Students') },
    { icon: <ListChecks className="h-5 w-5 text-[#05B43D]" />, value: fmt(platformStats.listings), label: t('ui.live_listings', 'Live Listings') },
    { icon: <TrendingUp className="h-5 w-5 text-[#05B43D]" />, value: fmt(platformStats.deals), label: t('ui.deals_closed', 'Deals Closed') },
    { icon: <Star className="h-5 w-5 text-[#05B43D]" />, value: `${platformStats.rating}★`, label: t('ui.avg_rating', 'Avg Rating') },
  ];

  return (
    <div className="min-h-screen bg-[#f4f5f0] flex items-center justify-center p-4 lg:p-8">
      <div className="w-full max-w-[1400px] grid lg:grid-cols-[1.2fr_0.8fr] gap-0 overflow-hidden rounded-2xl shadow-2xl shadow-black/10">

        {/* ── Left: Register Form ─────────────────────────── */}
        <div className="bg-white px-10 py-10 sm:px-14">
          {/* Logo */}
          <div className="mb-6 flex items-center gap-2.5">
            <ShoppingBag className="h-8 w-8 rounded-xl bg-[#05B43D] p-1.5 text-white" />
            <span className="text-xl font-extrabold text-[#05B43D]">UNITRADE</span>
          </div>

          <h1 className="text-3xl font-extrabold text-[#111111]">{t('ui.join_unitrade', 'Join UNITRADE')}</h1>
          <p className="mt-1.5 text-sm text-[#8A8A8A]">
            {t('ui.fill_in_your_details_to_create_a_verified_student_', 'Fill in your details to create a verified student marketplace account.')}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && <Alert variant="destructive" className="rounded-xl"><AlertDescription>{error}</AlertDescription></Alert>}
            {confirmationLink && (
              <Alert className="rounded-xl border-green-200 bg-green-50 text-green-800">
                <AlertDescription>
                  {t('ui.use_this_confirmation_link', 'Use this confirmation link:')}{' '}
                  <a href={confirmationLink} className="font-bold underline break-all">{confirmationLink}</a>
                </AlertDescription>
              </Alert>
            )}

            {/* Name + Email */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-bold uppercase tracking-widest text-[#4A4A4A]">{t('ui.full_name', 'Full Name')}</Label>
                <Input id="name" type="text" placeholder="Amina Ngoma" value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="h-11 rounded-xl border-[#DDE3E2] bg-[#F3F5F4] focus-visible:border-[#05B43D] focus-visible:ring-[#05B43D]/20" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-[#4A4A4A]">{t('ui.university_email', 'University Email')}</Label>
                <Input id="email" type="email" placeholder="your.email@student.ub.cm" value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="h-11 rounded-xl border-[#DDE3E2] bg-[#F3F5F4] focus-visible:border-[#05B43D] focus-visible:ring-[#05B43D]/20" required />
              </div>
            </div>

            {/* Phone + University */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-widest text-[#4A4A4A]">{t('ui.phone_number', 'Phone Number')}</Label>
                <Input id="phone" type="tel" placeholder="+237 670 123 456" value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="h-11 rounded-xl border-[#DDE3E2] bg-[#F3F5F4] focus-visible:border-[#05B43D] focus-visible:ring-[#05B43D]/20" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="university" className="text-xs font-bold uppercase tracking-widest text-[#4A4A4A]">{t('ui.university', 'University')}</Label>
                <Select value={formData.university} onValueChange={(v) => handleChange('university', v)} required>
                  <SelectTrigger className="h-11 rounded-xl border-[#DDE3E2] bg-[#F3F5F4] focus:border-[#05B43D]">
                    <SelectValue placeholder={t('ui.select_your_university', 'Select your university')} />
                  </SelectTrigger>
                  <SelectContent>
                    {universities.map((uni) => <SelectItem key={uni.id} value={uni.id}>{uni.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Student ID */}
            <div className="space-y-1.5">
              <Label htmlFor="studentId" className="text-xs font-bold uppercase tracking-widest text-[#4A4A4A]">{t('ui.student_id_optional', 'Student ID (Optional)')}</Label>
              <Input id="studentId" type="text" placeholder="UB2024001" value={formData.studentId}
                onChange={(e) => handleChange('studentId', e.target.value)}
                className="h-11 rounded-xl border-[#DDE3E2] bg-[#F3F5F4] focus-visible:border-[#05B43D] focus-visible:ring-[#05B43D]/20" />
            </div>

            {/* Profile Picture */}
            <div className="rounded-xl border border-[#DDE3E2] bg-[#F3F5F4] p-3">
              <Label className="text-xs font-bold uppercase tracking-widest text-[#4A4A4A]">{t('ui.profile_picture_optional', 'Profile Picture (Optional)')}</Label>
              <div className="mt-2 flex items-center gap-3">
                <Avatar className="h-12 w-12 border-2 border-[#05B43D]/30">
                  {formData.profilePicture ? <AvatarImage src={formData.profilePicture} alt={formData.name || 'Profile'} /> : null}
                  <AvatarFallback className="bg-[#e8f9ee] text-[#05B43D] font-bold">{(formData.name || 'U').charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <Input type="file" accept="image/*" disabled={uploadingProfilePicture}
                    onChange={(e) => handleProfilePictureUpload(e.target.files?.[0] || null)}
                    className="h-9 rounded-lg border-[#DDE3E2] bg-white text-sm" />
                  {uploadingProfilePicture && <p className="mt-1 flex items-center gap-1 text-xs text-[#05B43D]"><Upload className="h-3 w-3" />{t('ui.uploading', 'Uploading...')}</p>}
                </div>
              </div>
            </div>

            {/* Account type */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-[#4A4A4A]">{t('ui.i_want_to', 'I want to:')}</Label>
              <RadioGroup value={formData.userType} onValueChange={(v) => handleChange('userType', v)} className="grid gap-2 sm:grid-cols-2">
                <Label htmlFor="buyer" className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition-all ${formData.userType === 'buyer' ? 'border-[#05B43D] bg-[#e8f9ee]' : 'border-[#DDE3E2] bg-white hover:border-[#05B43D]/40'}`}>
                  <RadioGroupItem value="buyer" id="buyer" />
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-bold text-[#111111]"><ShoppingCart className="h-4 w-4 text-[#05B43D]" />{t('ui.buy_items', 'Buy Items')}</p>
                    <p className="text-xs text-[#8A8A8A]">{t('ui.browse_and_purchase', 'Browse and purchase')}</p>
                  </div>
                </Label>
                <Label htmlFor="seller" className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition-all ${formData.userType === 'seller' ? 'border-[#05B43D] bg-[#e8f9ee]' : 'border-[#DDE3E2] bg-white hover:border-[#05B43D]/40'}`}>
                  <RadioGroupItem value="seller" id="seller" />
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-bold text-[#111111]"><Store className="h-4 w-4 text-[#05B43D]" />{t('ui.sell_items', 'Sell Items')}</p>
                    <p className="text-xs text-[#8A8A8A]">{t('ui.list_and_earn', 'List and earn')}</p>
                  </div>
                </Label>
              </RadioGroup>
            </div>

            {/* Password */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-bold uppercase tracking-widest text-[#4A4A4A]">{t('ui.password', 'Password')}</Label>
                <PasswordInput id="password" placeholder="Min. 6 characters" value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  className="h-11 rounded-xl border-[#DDE3E2] bg-[#F3F5F4] focus-visible:border-[#05B43D]" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-xs font-bold uppercase tracking-widest text-[#4A4A4A]">{t('ui.confirm_password', 'Confirm Password')}</Label>
                <PasswordInput id="confirmPassword" placeholder="Re-enter password" value={formData.confirmPassword}
                  onChange={(e) => handleChange('confirmPassword', e.target.value)}
                  className="h-11 rounded-xl border-[#DDE3E2] bg-[#F3F5F4] focus-visible:border-[#05B43D]" required />
              </div>
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#05B43D] text-base font-bold text-white shadow-lg shadow-[#05B43D]/30 hover:bg-[#018F2D] transition-all disabled:opacity-60">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />{t('ui.creating_account', 'Creating Account...')}</> : <>{t('ui.sign_up', 'Sign Up')} <ArrowRight className="h-4 w-4" /></>}
            </button>

            <p className="text-center text-sm text-[#8A8A8A]">
              {t('ui.already_have_an_account', 'Already have an account?')}{' '}
              <Link to="/login" className="font-bold text-[#05B43D] hover:text-[#018F2D] hover:underline">{t('ui.sign_in', 'Sign In')}</Link>
            </p>
          </form>
        </div>

        {/* ── Right: Stats Panel ──────────────────────────── */}
        <div className="hidden lg:flex lg:flex-col bg-[#F3F5F4] px-10 py-12">
          <h2 className="text-4xl font-extrabold leading-tight text-[#111111]">
            {t('ui.buy_sell_connect', 'Buy. Sell.')}<br />{t('ui.connect', 'Connect.')}
          </h2>
          <p className="mt-3 text-sm text-[#8A8A8A]">
            {t('ui.student_to_student_marketplace', 'The student to student marketplace — buy, sell and rent safely on campus.')}
          </p>

          {/* Stats grid */}
          <div className="mt-8 grid grid-cols-2 gap-4">
            {stats.map((s, i) => (
              <div key={i} className="rounded-2xl border border-[#DDE3E2] bg-white p-5 shadow-sm">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[#e8f9ee]">{s.icon}</div>
                <p className="text-2xl font-extrabold text-[#111111]">{s.value}</p>
                <p className="mt-0.5 text-xs font-semibold uppercase tracking-widest text-[#8A8A8A]">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Bottom note */}
          <div className="mt-auto pt-8 rounded-2xl border border-[#DDE3E2] bg-white p-5 text-center">
            <ShoppingBag className="mx-auto mb-2 h-8 w-8 text-[#05B43D]" />
            <p className="text-sm font-semibold text-[#111111]">{t('ui.student_to_student_trading', 'Student to student trading.')}</p>
            <p className="mt-1 text-xs text-[#8A8A8A]">{t('ui.verified_safe_and_trusted', 'Verified, safe and trusted across Cameroon.')}</p>
          </div>
        </div>

      </div>
    </div>
  );
}
