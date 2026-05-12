import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { PasswordInput } from '@/app/components/ui/password-input';
import { Label } from '@/app/components/ui/label';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Loader2, Mail, Lock, ShieldCheck, BadgeCheck } from 'lucide-react';
import { toast } from 'sonner';
import appLogo from '@/assets/image/logoi.png';

const loginHeroImage =
  'https://images.pexels.com/photos/9158720/pexels-photo-9158720.jpeg?cs=srgb&dl=pexels-mikhail-nilov-9158720.jpg&fm=jpg';

export function Login() {
  const navigate = useNavigate();
  const { login, resendConfirmationEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberDevice, setRememberDevice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [confirmationLink, setConfirmationLink] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setConfirmationMessage('');
    setConfirmationLink('');
    setLoading(true);

    try {
      const result = await login(email, password, { rememberDevice });
      if (result.success) {
        toast.success('Login successful!');
        navigate('/dashboard');
      } else {
        setError(result.error || 'Invalid email or password');
      }
    } catch (_err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError('Enter your email first to resend confirmation.');
      return;
    }

    setError('');
    setConfirmationMessage('');
    setConfirmationLink('');
    setResendingConfirmation(true);

    try {
      const result = await resendConfirmationEmail(normalizedEmail);
      if (!result.success) {
        setError(result.error || 'Failed to resend confirmation email.');
        return;
      }

      const message = result.message || 'If your account exists, a confirmation email has been sent.';
      setConfirmationMessage(message);
      setConfirmationLink(result.confirmationLink || '');
      toast.success(message);
    } catch (_err) {
      setError('Failed to resend confirmation email.');
    } finally {
      setResendingConfirmation(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <div className="mx-auto grid min-h-screen max-w-[1440px] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between">
          <img src={loginHeroImage} alt="Black student studying with laptop" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(31,175,154,0.55)_0%,rgba(26,150,135,0.6)_40%,rgba(21,120,110,0.7)_100%)]" />

          <div className="relative z-10 px-10 pt-10 text-white xl:px-14 xl:pt-12">
            <div className="mb-20 flex items-center gap-3">
              <img src={appLogo} alt="UNITRADE logo" className="h-11 w-11 rounded-2xl object-cover" />
              <p className="text-[2rem] font-bold tracking-tight">UNITRADE</p>
            </div>

            <h2 className="max-w-sm text-6xl font-bold leading-[1.03]">
              Academic Commerce <span className="text-[#1FAF9A]">Redefined.</span>
            </h2>
            <p className="mt-8 max-w-[35rem] text-[1.95rem] leading-[1.45] text-emerald-50/90">
              The exclusive marketplace for Cameroon&apos;s academic community. Buy, sell, and trade with verified peers
              across university campuses.
            </p>

            <div className="mt-16 grid max-w-xl grid-cols-2 gap-10">
              <div className="space-y-1">
                <p className="text-5xl font-semibold leading-none text-emerald-300">15k+</p>
                <p className="text-[1.05rem] uppercase tracking-[0.2em] text-emerald-50/85">Active students</p>
              </div>
              <div className="space-y-1 border-l border-emerald-200/40 pl-10">
                <p className="text-5xl font-semibold leading-none text-emerald-300">24+</p>
                <p className="text-[1.05rem] uppercase tracking-[0.2em] text-emerald-50/85">Partner institutions</p>
              </div>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-10 px-10 pb-8 text-xs uppercase tracking-[0.18em] text-emerald-100/80 xl:px-14">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              SSL secured
            </span>
            <span className="inline-flex items-center gap-2">
              <BadgeCheck className="h-4 w-4" />
              Student verified
            </span>
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-9 lg:px-16 xl:px-20">
          <div className="w-full max-w-[480px]">
            {/* Header */}
            <div className="mb-8">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700">
                👋 Welcome back!
              </div>
              <h1 className="font-sora text-3xl font-extrabold leading-tight text-gray-900 sm:text-4xl">
                Sign in to your account
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                Access your campus marketplace — buy, sell, and connect with students.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <Alert variant="destructive" className="rounded-xl">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-semibold text-gray-700">
                  Institutional Email
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-500" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="student@ubuea.cm"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 rounded-xl border-gray-200 bg-gray-50 pl-10 text-sm focus-visible:border-teal-400 focus-visible:ring-teal-100"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-semibold text-gray-700">Password</Label>
                  <Link to="/forgot-password" className="text-xs font-semibold text-teal-600 hover:text-teal-800 hover:underline">
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-teal-500" />
                  <PasswordInput
                    id="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 rounded-xl border-gray-200 bg-gray-50 pl-10 text-sm focus-visible:border-teal-400 focus-visible:ring-teal-100"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Checkbox
                  id="remember-device"
                  checked={rememberDevice}
                  onCheckedChange={(checked) => setRememberDevice(checked === true)}
                  className="h-4 w-4 rounded border-gray-300 data-[state=checked]:border-teal-500 data-[state=checked]:bg-teal-500"
                />
                <Label htmlFor="remember-device" className="cursor-pointer text-sm font-normal text-gray-600">
                  Remember me on this device
                </Label>
              </div>

              <Button
                type="submit"
                className="h-12 w-full rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 text-sm font-bold text-white shadow-lg shadow-teal-500/25 hover:from-teal-400 hover:to-teal-500 transition-all"
                disabled={loading}
              >
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</> : '→ Sign In to Account'}
              </Button>

              <div className="flex items-center gap-3 text-xs text-gray-300">
                <span className="h-px flex-1 bg-gray-200" />
                <span className="font-medium text-gray-400">New to UNITRADE?</span>
                <span className="h-px flex-1 bg-gray-200" />
              </div>

              <Button type="button" variant="secondary" asChild
                className="h-12 w-full rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50">
                <Link to="/register">🎓 Create Student Account</Link>
              </Button>

              {confirmationMessage && (
                <Alert className="rounded-xl border-teal-200 bg-teal-50 text-teal-800">
                  <AlertDescription>
                    {confirmationMessage}{' '}
                    {confirmationLink && <a href={confirmationLink} className="font-bold underline">Open link</a>}
                  </AlertDescription>
                </Alert>
              )}

              <p className="text-center text-xs text-gray-500">
                Didn&apos;t receive verification?{' '}
                <button type="button" onClick={handleResendConfirmation} disabled={resendingConfirmation}
                  className="font-semibold text-teal-600 hover:underline disabled:opacity-60">
                  {resendingConfirmation ? 'Sending...' : 'Resend Confirmation'}
                </button>
              </p>
            </form>

            <div className="mt-8 flex items-center justify-center gap-6 text-xs text-gray-400">
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-teal-500" />SSL Secured</span>
              <span className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-teal-500" />Student Verified</span>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-[10px] uppercase tracking-widest text-gray-300">
              <p>© 2026 UNITRADE Cameroon</p>
              <div className="flex gap-4">
                <a href="#" className="hover:text-gray-500">Privacy</a>
                <a href="#" className="hover:text-gray-500">Terms</a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
