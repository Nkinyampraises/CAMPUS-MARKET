import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { PasswordInput } from '@/app/components/ui/password-input';
import { Label } from '@/app/components/ui/label';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Loader2, Mail, Lock, ShieldCheck, BadgeCheck, Sparkles, MessageSquare, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import appLogo from '@/assets/image/logoi.png';
import { useLanguage } from '@/contexts/LanguageContext';

const loginHeroImage =
  'https://images.pexels.com/photos/9158720/pexels-photo-9158720.jpeg?cs=srgb&dl=pexels-mikhail-nilov-9158720.jpg&fm=jpg';

export function Login() {
  const navigate = useNavigate();
  const { login, resendConfirmationEmail } = useAuth();
  const { t } = useLanguage();
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

  const features = [
    {
      icon: <Sparkles className="h-5 w-5 text-[#05B43D]" />,
      bg: 'bg-[#e8f9ee]',
      title: t('ui.sasha_ai_assistant', 'Sasha AI Assistant'),
      desc: t('ui.get_smart_product_recommendations_room_setup_ideas_a', 'Get smart product recommendations, room setup ideas, and instant answers from Sasha.'),
    },
    {
      icon: <MessageSquare className="h-5 w-5 text-[#05B43D]" />,
      bg: 'bg-[#e8f9ee]',
      title: t('ui.buy_sell_securely', 'Buy & Sell Securely'),
      desc: t('ui.escrow_protection_ensures_your_money_is_safe_until_i', 'Escrow protection ensures your money is safe until item is received and confirmed.'),
    },
    {
      icon: <ShieldCheck className="h-5 w-5 text-[#05B43D]" />,
      bg: 'bg-[#e8f9ee]',
      title: t('ui.verified_students_only', 'Verified Students Only'),
      desc: t('ui.exclusively_for_cameroon_university_students_safe_me', 'Exclusively for Cameroon university students. Safe meetups on campus, verified identities.'),
    },
  ];

  return (
    <div className="min-h-screen bg-[#f4f5f0] flex items-center justify-center p-4 lg:p-8">
      <div className="w-full max-w-[1100px] grid lg:grid-cols-2 gap-0 overflow-hidden rounded-2xl shadow-2xl shadow-black/10">

        {/* ── Left: Login Form ────────────────────────────── */}
        <div className="bg-white px-8 py-10 sm:px-12 sm:py-12">
          {/* Logo */}
          <div className="mb-8 flex items-center gap-2.5">
            <img src={appLogo} alt="UNITRADE" className="h-9 w-9 rounded-xl object-cover" />
            <span className="text-xl font-extrabold text-[#05B43D]">UNITRADE</span>
          </div>

          <h1 className="text-3xl font-extrabold text-[#111111]">{t('ui.welcome_back', 'Welcome Back')}</h1>
          <p className="mt-2 text-base text-[#8A8A8A]">
            {t('ui.securely_access_your_campus_marketplace', 'Securely access your campus marketplace.')}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && (
              <Alert variant="destructive" className="rounded-xl">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-[#4A4A4A]">
                {t('ui.email_address', 'Email Address')}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="student@ubuea.cm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-xl border-[#DDE3E2] bg-[#F3F5F4] text-base text-[#111111] placeholder:text-[#aaaaaa] focus-visible:border-[#05B43D] focus-visible:ring-[#05B43D]/20"
                required
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-bold uppercase tracking-widest text-[#4A4A4A]">
                  {t('ui.password', 'Password')}
                </Label>
                <Link to="/forgot-password" className="text-sm font-semibold text-[#05B43D] hover:text-[#018F2D] hover:underline">
                  {t('ui.forgot', 'Forgot?')}
                </Link>
              </div>
              <PasswordInput
                id="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-xl border-[#DDE3E2] bg-[#F3F5F4] text-base text-[#111111] placeholder:text-[#aaaaaa] focus-visible:border-[#05B43D] focus-visible:ring-[#05B43D]/20"
                required
              />
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-2.5">
              <Checkbox
                id="remember-device"
                checked={rememberDevice}
                onCheckedChange={(checked) => setRememberDevice(checked === true)}
                className="h-4 w-4 rounded border-[#DDE3E2] data-[state=checked]:border-[#05B43D] data-[state=checked]:bg-[#05B43D]"
              />
              <Label htmlFor="remember-device" className="cursor-pointer text-sm font-normal text-[#4A4A4A]">
                {t('ui.remember_me_on_this_device', 'Remember me on this device')}
              </Label>
            </div>

            {/* Sign In button */}
            <Button
              type="submit"
              className="h-12 w-full rounded-xl bg-[#05B43D] text-base font-bold text-white shadow-lg shadow-[#05B43D]/30 hover:bg-[#018F2D] transition-all"
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('ui.signing_in', 'Signing in...')}</>
              ) : (
                <span className="flex items-center gap-2">{t('ui.sign_in', 'Sign In')} <ArrowRight className="h-4 w-4" /></span>
              )}
            </Button>

            {/* Divider */}
            <div className="flex items-center gap-3 text-xs text-[#aaaaaa]">
              <span className="h-px flex-1 bg-[#DDE3E2]" />
              {t('ui.or_continue_with', 'OR CONTINUE WITH')}
              <span className="h-px flex-1 bg-[#DDE3E2]" />
            </div>

            {/* Register link */}
            <p className="text-center text-sm text-[#4A4A4A]">
              {t('ui.dont_have_an_account', "Don't have an account?")}{' '}
              <Link to="/register" className="font-bold text-[#05B43D] hover:text-[#018F2D] hover:underline">
                {t('ui.sign_up_free', 'Sign up free')}
              </Link>
            </p>

            {confirmationMessage && (
              <Alert className="rounded-xl border-[#05B43D]/30 bg-[#e8f9ee] text-[#018F2D]">
                <AlertDescription>
                  {confirmationMessage}{' '}
                  {confirmationLink && (
                    <a href={confirmationLink} className="font-bold underline underline-offset-2">
                      {t('ui.open_link', 'Open link')}
                    </a>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <p className="text-center text-sm text-[#8A8A8A]">
              {t('ui.didnt_receive_verification', "Didn't receive verification?")}{' '}
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={resendingConfirmation}
                className="font-bold text-[#05B43D] hover:underline disabled:opacity-50"
              >
                {resendingConfirmation ? t('ui.sending', 'Sending...') : t('ui.resend_confirmation', 'Resend Confirmation')}
              </button>
            </p>
          </form>

          <p className="mt-8 text-center text-xs text-[#aaaaaa]">
            © 2026 UNITRADE Cameroon &nbsp;·&nbsp;
            <a href="#" className="hover:text-[#05B43D]">{t('ui.privacy', 'Privacy')}</a>
            &nbsp;·&nbsp;
            <a href="#" className="hover:text-[#05B43D]">{t('ui.terms', 'Terms')}</a>
          </p>
        </div>

        {/* ── Right: Why UNITRADE ─────────────────────────── */}
        <div className="hidden lg:flex lg:flex-col bg-[#F3F5F4] px-10 py-12">
          <h2 className="mb-8 text-2xl font-extrabold text-[#111111]">
            {t('ui.why_unitrade', 'Why UNITRADE?')}
          </h2>

          <div className="flex flex-col gap-4">
            {features.map((f, i) => (
              <div key={i} className="flex items-start gap-4 rounded-2xl border border-[#DDE3E2] bg-white p-5 shadow-sm">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${f.bg}`}>
                  {f.icon}
                </div>
                <div>
                  <p className="text-base font-bold text-[#111111]">{f.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-[#8A8A8A]">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-[#DDE3E2] bg-white p-4 text-center">
              <p className="text-3xl font-extrabold text-[#05B43D]">15k+</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-[#8A8A8A]">{t('ui.active_students', 'Active Students')}</p>
            </div>
            <div className="rounded-2xl border border-[#DDE3E2] bg-white p-4 text-center">
              <p className="text-3xl font-extrabold text-[#05B43D]">24+</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-[#8A8A8A]">{t('ui.universities', 'Universities')}</p>
            </div>
          </div>

          {/* CTA */}
          <Button
            type="button"
            asChild
            className="mt-auto pt-8"
          >
            <Link
              to="/register"
              className="flex h-12 w-full items-center justify-center rounded-xl bg-[#05B43D] text-base font-bold text-white shadow-lg shadow-[#05B43D]/30 hover:bg-[#018F2D] transition-all"
            >
              {t('ui.create_account', 'Create Account')}
            </Link>
          </Button>

          <div className="mt-4 flex items-center justify-center gap-6 text-xs text-[#aaaaaa]">
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#05B43D]" /> SSL Secured</span>
            <span className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-[#05B43D]" /> Student Verified</span>
          </div>
        </div>

      </div>
    </div>
  );
}
