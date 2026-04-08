import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { PasswordInput } from '@/app/components/ui/password-input';
import { Label } from '@/app/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { ShoppingBag, Loader2, Sparkles, ShieldCheck, MapPin, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

const TWO_FACTOR_CODE_PATTERN = /^\d{6}$/;

export function Login() {
  const navigate = useNavigate();
  const { login, verifyTwoFactorCode, resendTwoFactorCode, resendConfirmationEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorMessage, setTwoFactorMessage] = useState('');
  const [twoFactorPreviewCode, setTwoFactorPreviewCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendingTwoFactor, setResendingTwoFactor] = useState(false);
  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [confirmationLink, setConfirmationLink] = useState('');

  const isTwoFactorStep = Boolean(twoFactorToken);

  const resetTwoFactorStep = () => {
    setTwoFactorToken('');
    setTwoFactorCode('');
    setTwoFactorMessage('');
    setTwoFactorPreviewCode('');
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setConfirmationMessage('');
    setConfirmationLink('');
    setLoading(true);

    try {
      const result = await login(email, password);
      if (result.success) {
        toast.success('Login successful!');
        navigate('/dashboard');
      } else if (result.requiresTwoFactor && result.twoFactorToken) {
        setTwoFactorToken(result.twoFactorToken);
        setTwoFactorMessage(result.message || 'Enter the verification code to continue.');
        setTwoFactorPreviewCode(result.verificationCode || '');
        setTwoFactorCode('');
        setError('');
        toast.success(result.message || 'Verification code sent.');
      } else {
        console.error('Login failed:', result.error);
        setError(result.error || 'Invalid email or password');
      }
    } catch (_err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const normalizedCode = twoFactorCode.replace(/\s+/g, '');
    if (!TWO_FACTOR_CODE_PATTERN.test(normalizedCode)) {
      setError('Enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const result = await verifyTwoFactorCode(twoFactorToken, normalizedCode);
      if (result.success) {
        toast.success('Login successful!');
        navigate('/dashboard');
      } else {
        setError(result.error || 'Invalid verification code');
      }
    } catch (_err) {
      setError('Failed to verify code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendTwoFactor = async () => {
    if (!twoFactorToken || resendingTwoFactor) {
      return;
    }

    setError('');
    setResendingTwoFactor(true);
    try {
      const result = await resendTwoFactorCode(twoFactorToken);
      if (result.success) {
        if (result.message) {
          setTwoFactorMessage(result.message);
          toast.success(result.message);
        } else {
          toast.success('A new verification code has been sent.');
        }
        setTwoFactorPreviewCode(result.verificationCode || '');
      } else {
        setError(result.error || 'Failed to resend verification code');
      }
    } catch (_err) {
      setError('Failed to resend verification code');
    } finally {
      setResendingTwoFactor(false);
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
    <div
      className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_55%),radial-gradient(circle_at_30%_20%,_rgba(14,165,233,0.16),_transparent_50%),linear-gradient(120deg,_#f8fafc_0%,_#eefbf6_45%,_#f2f7ff_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_55%),radial-gradient(circle_at_30%_20%,_rgba(14,165,233,0.2),_transparent_50%),linear-gradient(120deg,_#031b14_0%,_#051f2c_55%,_#041a21_100%)]"
      style={
        {
          '--login-accent': '#1f7a34',
          '--login-accent-2': '#0ea5a5',
          '--login-ink': '#072917',
        } as React.CSSProperties
      }
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 right-[-6rem] h-72 w-72 rounded-full bg-emerald-300/40 blur-3xl dark:bg-emerald-500/20" />
        <div className="absolute bottom-[-10rem] left-[-6rem] h-80 w-80 rounded-full bg-sky-200/50 blur-3xl dark:bg-sky-500/20" />
        <div className="absolute left-1/2 top-12 h-16 w-16 -translate-x-1/2 rounded-2xl border border-emerald-200/70 bg-white/60 backdrop-blur-md dark:border-emerald-500/30 dark:bg-white/10" />
      </div>

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 lg:py-16">
        <div className="grid items-stretch gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <Card className="h-full rounded-3xl border border-emerald-100/80 bg-white/90 shadow-[0_30px_80px_-40px_rgba(15,118,110,0.45)] backdrop-blur-sm dark:border-emerald-500/20 dark:bg-slate-950/60 animate-[login-rise_0.65s_ease-out] lg:order-1 lg:col-start-1">
            <CardHeader className="space-y-3 text-left">
                <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-emerald-100/80 text-[color:var(--login-accent)] flex items-center justify-center dark:bg-emerald-500/20">
                  <ShoppingBag className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-serif text-[color:var(--login-ink)] dark:text-white">
                    {isTwoFactorStep ? 'Two-step verification' : 'Welcome back'}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {isTwoFactorStep
                      ? 'Enter the 6-digit code sent to your email to finish signing in.'
                      : 'Sign in to manage your campus listings and orders.'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={isTwoFactorStep ? handleTwoFactorSubmit : handlePasswordSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {!isTwoFactorStep ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="your.email@student.ub.cm"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <PasswordInput
                        id="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <Link to="/forgot-password" className="text-emerald-600 hover:underline">
                        Forgot password?
                      </Link>
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 text-emerald-600 hover:text-emerald-700"
                        onClick={handleResendConfirmation}
                        disabled={resendingConfirmation}
                      >
                        {resendingConfirmation ? (
                          <>
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          'Resend confirmation email'
                        )}
                      </Button>
                    </div>

                    {confirmationMessage && (
                      <Alert>
                        <AlertDescription>
                          {confirmationMessage}{' '}
                          {confirmationLink && (
                            <a
                              href={confirmationLink}
                              className="font-medium text-emerald-700 underline underline-offset-2"
                            >
                              Open confirmation link
                            </a>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}

                    <Button
                      type="submit"
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Logging in...
                        </>
                      ) : (
                        'Login'
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    {twoFactorMessage && (
                      <Alert>
                        <AlertDescription>{twoFactorMessage}</AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="verification-code">Verification code</Label>
                      <Input
                        id="verification-code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="Enter 6-digit code"
                        value={twoFactorCode}
                        onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        maxLength={6}
                        required
                      />
                    </div>

                    {twoFactorPreviewCode && (
                      <Alert>
                        <AlertDescription>
                          Development code: <span className="font-semibold tracking-[0.18em]">{twoFactorPreviewCode}</span>
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleResendTwoFactor}
                        disabled={resendingTwoFactor}
                        className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      >
                        {resendingTwoFactor ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Resending...
                          </>
                        ) : (
                          'Resend code'
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={resetTwoFactorStep}
                        className="text-muted-foreground"
                      >
                        Use another account
                      </Button>
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        'Verify and continue'
                      )}
                    </Button>
                  </>
                )}
              </form>

            </CardContent>
            <CardFooter className="flex flex-col items-start gap-2 text-sm">
              <p className="text-muted-foreground">
                Don't have an account?{' '}
                <Link to="/register" className="text-emerald-600 hover:underline">
                  Sign up
                </Link>
              </p>
            </CardFooter>
          </Card>

          <section className="relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-emerald-200/40 bg-gradient-to-br from-emerald-900 via-emerald-800 to-slate-900 p-8 text-white shadow-[0_30px_80px_-40px_rgba(3,105,81,0.6)] animate-[login-slide_0.8s_ease-out] lg:order-2 lg:col-start-2">
            <div className="absolute inset-0 opacity-60">
              <div className="absolute -right-16 top-10 h-40 w-40 rounded-full border border-white/20 bg-white/5" />
              <div className="absolute bottom-12 left-8 h-24 w-24 rounded-2xl border border-white/20 bg-white/5" />
            </div>

            <div className="relative space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.35em] text-emerald-100">
                UNITRADE
              </div>
              <h2 className="text-3xl font-serif leading-tight text-white sm:text-4xl">
                A trusted marketplace built for campus life.
              </h2>
              <p className="text-sm text-emerald-50/80 sm:text-base">
                Sell, rent, and discover essentials from verified students. Keep payments safe, chat instantly, and
                meet at trusted pickup spots around your university.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  {
                    title: 'Verified students',
                    detail: 'Profiles built around your campus community.',
                    icon: ShieldCheck,
                    delay: '0ms',
                  },
                  {
                    title: 'Chat & negotiate',
                    detail: 'Message sellers before you commit.',
                    icon: MessageCircle,
                    delay: '120ms',
                  },
                  {
                    title: 'Safe pickups',
                    detail: 'Approved locations for every exchange.',
                    icon: MapPin,
                    delay: '240ms',
                  },
                  {
                    title: 'Smart listings',
                    detail: 'Highlight items with premium visibility.',
                    icon: Sparkles,
                    delay: '360ms',
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-white/15 bg-white/10 p-4 text-sm shadow-sm animate-[login-fade_0.9s_ease-out] backdrop-blur-sm"
                    style={{ animationDelay: item.delay }}
                  >
                    <item.icon className="mb-3 h-5 w-5 text-emerald-200" />
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-1 text-xs text-emerald-100/70">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mt-8 grid grid-cols-3 gap-3 text-xs">
              {[
                { label: 'New listings', value: 'Every day' },
                { label: 'Escrow ready', value: 'Mobile money' },
                { label: 'Support', value: '24/7 help desk' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/15 bg-white/10 p-3 text-center">
                  <p className="text-lg font-semibold">{stat.value}</p>
                  <p className="mt-1 text-[0.65rem] uppercase tracking-[0.2em] text-emerald-100/70">{stat.label}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

