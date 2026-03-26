import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { getUniversityName } from '@/data/mockData';
import { toast } from 'sonner';

import { API_URL } from '@/lib/api';

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
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingProfilePicture, setUploadingProfilePicture] = useState(false);
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
    if (!isAuthenticated || !currentUser) {
      navigate('/login');
    }
  }, [isAuthenticated, currentUser, navigate]);

  if (!isAuthenticated || !currentUser) {
    return null;
  }

  const universityName = getUniversityName(currentUser.university);

  const handleSaveProfile = async () => {
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

  const displayName = isEditing ? formData.name || currentUser.name : currentUser.name;
  const displayProfilePicture =
    isEditing ? formData.profilePicture || currentUser.profilePicture || '' : currentUser.profilePicture || '';
  const joinedLabel = currentUser.createdAt
    ? new Date(currentUser.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : 'Recently joined';
  const reviewAverage = Number.isFinite(currentUser.rating) ? currentUser.rating.toFixed(1) : '0.0';
  const visibilityLabel =
    currentUser.privacyOptions?.profileVisibility === 'private' ? 'Private Profile' : 'Public Profile';
  const subscriptionLabel = formatLabel(currentUser.subscriptionStatus, 'Trial Access');
  const completionItems = [
    { label: 'Profile photo added', complete: Boolean((displayProfilePicture || '').trim()) },
    { label: 'Phone number added', complete: Boolean((formData.phone || currentUser.phone || '').trim()) },
    { label: 'Student ID added', complete: Boolean((formData.studentId || currentUser.studentId || '').trim()) },
    { label: 'University linked', complete: Boolean(currentUser.university) },
  ];
  const completionPercent = Math.round(
    (completionItems.filter((item) => item.complete).length / completionItems.length) * 100,
  );
  const summaryCards = [
    {
      label: 'Average Rating',
      value: reviewAverage,
      caption: `${currentUser.reviewCount} student review${currentUser.reviewCount === 1 ? '' : 's'}`,
      icon: Star,
      accent: 'from-amber-400 to-orange-500',
    },
    {
      label: 'Account Type',
      value: formatLabel(currentUser.userType, 'Buyer'),
      caption: currentUser.role === 'admin' ? 'Admin access enabled' : 'Campus marketplace member',
      icon: ShieldCheck,
      accent: 'from-emerald-500 to-teal-500',
    },
    {
      label: 'Subscription',
      value: subscriptionLabel,
      caption: currentUser.subscriptionEndDate
        ? `Ends ${new Date(currentUser.subscriptionEndDate).toLocaleDateString()}`
        : 'Trial or default access',
      icon: Award,
      accent: 'from-sky-500 to-cyan-500',
    },
  ];
  const heroMeta = [
    { label: 'Email', value: currentUser.email, icon: Mail },
    { label: 'Phone', value: currentUser.phone || 'Add a phone number', icon: Phone },
    { label: 'Member Since', value: joinedLabel, icon: CalendarDays },
    { label: 'Student ID', value: currentUser.studentId || 'Add your student ID', icon: IdCard },
  ];
  const detailCards = [
    { label: 'Full name', value: currentUser.name, icon: User },
    { label: 'Email address', value: currentUser.email, icon: Mail },
    { label: 'Phone number', value: currentUser.phone || 'Not added yet', icon: Phone },
    { label: 'University', value: universityName, icon: GraduationCap },
    { label: 'Student ID', value: currentUser.studentId || 'Not added yet', icon: IdCard },
    { label: 'Member since', value: joinedLabel, icon: CalendarDays },
  ];
  const trustItems = [
    {
      title: 'Verified student',
      description: currentUser.isVerified
        ? 'Your campus identity is confirmed and visible on your profile.'
        : 'Complete account verification to strengthen trust faster.',
      active: currentUser.isVerified,
      icon: CheckCircle,
    },
    {
      title: 'Trading access',
      description: currentUser.isBanned
        ? 'This account is currently restricted from marketplace activity.'
        : currentUser.isApproved
          ? 'You are approved to trade across the marketplace.'
          : 'Approval is still pending review.',
      active: currentUser.isApproved && !currentUser.isBanned,
      icon: ShieldCheck,
    },
    {
      title: 'Marketplace identity',
      description:
        currentUser.userType === 'seller'
          ? 'You are set up to list items, handle orders, and grow your reputation.'
          : 'You are ready to browse, save favorites, and buy from trusted students.',
      active: true,
      icon: Sparkles,
    },
  ];
  const nextSteps = completionItems.filter((item) => !item.complete);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_48%),radial-gradient(circle_at_85%_20%,_rgba(14,165,233,0.12),_transparent_35%),linear-gradient(160deg,_#f8fafc_0%,_#f0fdf4_36%,_#eff6ff_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_52%),radial-gradient(circle_at_85%_20%,_rgba(14,165,233,0.18),_transparent_36%),linear-gradient(160deg,_#031b14_0%,_#081420_52%,_#04161d_100%)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-[-4rem] h-72 w-72 rounded-full bg-emerald-300/35 blur-3xl dark:bg-emerald-500/15" />
        <div className="absolute right-[-6rem] top-24 h-80 w-80 rounded-full bg-sky-300/30 blur-3xl dark:bg-sky-500/12" />
        <div className="absolute bottom-[-6rem] left-1/3 h-72 w-72 rounded-full bg-amber-200/25 blur-3xl dark:bg-amber-400/10" />
      </div>

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <section className="space-y-4">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(135deg,rgba(236,253,245,0.92)_0%,rgba(239,246,255,0.92)_52%,rgba(255,251,235,0.9)_100%)] p-6 shadow-[0_40px_120px_-55px_rgba(15,118,110,0.55)] backdrop-blur-sm sm:p-8 dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(6,78,59,0.38)_0%,rgba(3,105,161,0.28)_55%,rgba(113,63,18,0.24)_100%)]">
              <div className="pointer-events-none absolute inset-0 opacity-70">
                <div className="absolute right-10 top-10 h-28 w-28 rounded-full border border-white/40 bg-white/30 dark:border-white/10 dark:bg-white/5" />
                <div className="absolute bottom-6 left-10 h-20 w-20 rounded-[1.5rem] border border-white/40 bg-white/30 dark:border-white/10 dark:bg-white/5" />
              </div>

              <div className="relative flex flex-col gap-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                    <div className="relative">
                      <Avatar className="h-28 w-28 rounded-[2rem] ring-4 ring-white shadow-xl dark:ring-slate-950">
                        {displayProfilePicture ? <AvatarImage src={displayProfilePicture} alt={displayName} /> : null}
                        <AvatarFallback className="bg-emerald-100 text-4xl font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                          {getInitial(displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-2 -right-2 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/80 bg-white text-emerald-600 shadow-lg dark:border-white/10 dark:bg-slate-900 dark:text-emerald-300">
                        <Camera className="h-4 w-4" />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700 shadow-sm dark:bg-white/10 dark:text-emerald-200">
                        <Sparkles className="h-3.5 w-3.5" />
                        Profile Studio
                      </div>
                      <div>
                        <h1 className="text-3xl font-serif leading-tight text-slate-950 dark:text-white sm:text-4xl">
                          {displayName}
                        </h1>
                        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
                          <span className="inline-flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                            {universityName}
                          </span>
                          <span className="inline-flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-sky-600 dark:text-sky-300" />
                            {formatLabel(currentUser.userType, 'Buyer')} account
                          </span>
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge className="rounded-full border-0 bg-emerald-600/10 px-3 py-1 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200">
                          {currentUser.isVerified ? 'Verified Student' : 'Verification Pending'}
                        </Badge>
                        <Badge className="rounded-full border-0 bg-sky-600/10 px-3 py-1 text-sky-700 dark:bg-sky-400/15 dark:text-sky-200">
                          {currentUser.isBanned
                            ? 'Restricted Account'
                            : currentUser.isApproved
                              ? 'Approved to Trade'
                              : 'Approval Pending'}
                        </Badge>
                        <Badge className="rounded-full border-0 bg-amber-500/10 px-3 py-1 text-amber-700 dark:bg-amber-400/15 dark:text-amber-200">
                          {visibilityLabel}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant={isEditing ? 'outline' : 'default'}
                      className={
                        isEditing
                          ? 'rounded-full border-white/70 bg-white/70 px-5 backdrop-blur hover:bg-white dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15'
                          : 'rounded-full bg-emerald-600 px-5 hover:bg-emerald-700'
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
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {heroMeta.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-[1.5rem] border border-white/70 bg-white/65 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/5"
                    >
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-950">
                        <item.icon className="h-4 w-4" />
                      </div>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                        {item.label}
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
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
                className="rounded-[1.75rem] border border-slate-200/80 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80"
              >
                <div className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${card.accent} text-white shadow-lg`}>
                  <card.icon className="h-5 w-5" />
                </div>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  {card.label}
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">{card.value}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{card.caption}</p>
              </div>
            ))}

            <div className="rounded-[1.75rem] bg-slate-950 p-5 text-white shadow-[0_25px_70px_-35px_rgba(15,23,42,0.8)] dark:bg-slate-900">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-200/80">
                    Profile Strength
                  </p>
                  <p className="mt-1 text-3xl font-semibold">{completionPercent}%</p>
                </div>
                <Sparkles className="h-6 w-6 text-emerald-300" />
              </div>
              <div className="mt-4 h-2.5 rounded-full bg-white/10">
                <div className="h-2.5 rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-300" style={{ width: `${completionPercent}%` }} />
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-300">
                {completionItems.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3">
                    <span>{item.label}</span>
                    <span className={item.complete ? 'text-emerald-300' : 'text-slate-500'}>
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
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700 dark:text-emerald-300">
              Account View
            </p>
            <h2 className="mt-2 text-2xl font-serif text-slate-950 dark:text-white sm:text-3xl">
              Profile details
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
              Keep your profile sharp, trustworthy, and easy for other students to understand at a glance.
            </p>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
              <Card className="rounded-[2rem] border border-white/70 bg-white/88 shadow-[0_30px_90px_-55px_rgba(15,118,110,0.5)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/70">
                <CardHeader className="space-y-3">
                  <div className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-600/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200">
                    <User className="h-3.5 w-3.5" />
                    Personal Profile
                  </div>
                  <CardTitle className="text-2xl font-serif text-slate-950 dark:text-white">
                    {isEditing ? 'Polish your public profile' : 'The details students will see first'}
                  </CardTitle>
                  <CardDescription className="max-w-2xl text-sm">
                    {isEditing
                      ? 'Update the essentials that make you look credible, clear, and easy to trust.'
                      : 'These details shape how buyers and sellers experience your account across the marketplace.'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isEditing ? (
                    <div className="space-y-5">
                      <div className="rounded-[1.75rem] border border-emerald-100/80 bg-emerald-50/70 p-5 dark:border-emerald-500/15 dark:bg-emerald-500/10">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                          <Avatar className="h-24 w-24 rounded-[1.5rem] ring-4 ring-white dark:ring-slate-950">
                            {displayProfilePicture ? <AvatarImage src={displayProfilePicture} alt={displayName} /> : null}
                            <AvatarFallback className="bg-emerald-100 text-3xl font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
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
                              className="bg-white/80 dark:bg-slate-950/60"
                            />
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              JPG, PNG, or WEBP up to 5MB. A clear photo helps your account feel more trustworthy.
                            </p>
                            {uploadingProfilePicture && (
                              <p className="inline-flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-200">
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
                            className="bg-white dark:bg-slate-950/60"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone number</Label>
                          <Input
                            id="phone"
                            value={formData.phone}
                            onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                            className="bg-white dark:bg-slate-950/60"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="studentId">Student ID</Label>
                          <Input
                            id="studentId"
                            value={formData.studentId}
                            onChange={(e) => setFormData((prev) => ({ ...prev, studentId: e.target.value }))}
                            className="bg-white dark:bg-slate-950/60"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Email address</Label>
                          <Input value={currentUser.email} disabled className="bg-slate-100 dark:bg-slate-900" />
                          <p className="text-xs text-slate-500 dark:text-slate-400">Email cannot be changed here.</p>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                          <Label>University</Label>
                          <Input value={universityName} disabled className="bg-slate-100 dark:bg-slate-900" />
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Your university stays fixed so your campus identity remains consistent.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                        <Button
                          onClick={handleSaveProfile}
                          disabled={uploadingProfilePicture}
                          className="flex-1 rounded-full bg-emerald-600 hover:bg-emerald-700"
                        >
                          Save changes
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setIsEditing(false);
                            resetForm();
                          }}
                          className="flex-1 rounded-full"
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
                          className="rounded-[1.5rem] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/60"
                        >
                          <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white">
                            <item.icon className="h-4 w-4" />
                          </div>
                          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                            {item.label}
                          </p>
                          <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
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
