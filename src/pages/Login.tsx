import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { ShoppingBag, Loader2, Sparkles, ShieldCheck, MapPin, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(email, password);
      if (result.success) {
        toast.success('Login successful!');
        navigate('/dashboard');
      } else {
        console.error('Login failed:', result.error);
        setError(result.error || 'Invalid email or password');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
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
                    Welcome back
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Sign in to manage your campus listings and orders.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

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
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="flex items-center justify-end text-sm">
              <Link to="/forgot-password" className="text-emerald-600 hover:underline">
                Forgot password?
              </Link>
            </div>

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

