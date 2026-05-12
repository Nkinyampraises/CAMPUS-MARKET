import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar';
import {
  ShoppingBag, Package, CreditCard, Plus, MessageSquare, User, LogOut,
  Home, LayoutDashboard, Settings, Heart, Bell, CircleHelp, Eye, Flag,
  ShieldAlert, Languages, Check, Sparkles,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useLanguage } from '@/contexts/LanguageContext';
import appLogo from '@/assets/image/logoi.png';
import { cn } from '@/app/components/ui/utils';

export function Header() {
  const { currentUser, logout, isAuthenticated } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => { logout(); navigate('/'); };
  const isActive = (path: string) => location.pathname === path;
  const isAdminArea = location.pathname === '/admin' || location.pathname.startsWith('/admin/') || location.pathname.startsWith('/admin-');
  const isBuyerArea = location.pathname === '/buyer/dashboard' || location.pathname.startsWith('/buyer/');
  const isSellerArea = location.pathname === '/seller/dashboard' || location.pathname.startsWith('/seller/');
  const dashboardPath = currentUser?.role === 'admin' ? '/admin' : currentUser?.userType === 'buyer' ? '/buyer/dashboard' : '/seller/dashboard';
  const isDashboardArea = currentUser?.role === 'admin' ? isAdminArea : currentUser?.userType === 'buyer' ? isBuyerArea : isSellerArea || location.pathname === '/dashboard';
  const profilePath = currentUser?.role === 'admin' ? '/admin/profile' : currentUser?.userType === 'buyer' ? '/buyer/profile' : '/seller/profile';

  const activeClass = 'bg-white/15 text-white shadow-sm ring-1 ring-white/20';
  const inactiveClass = 'text-teal-100/75 hover:bg-white/10 hover:text-white transition-all duration-200';

  return (
    <header className="header-gradient sticky top-0 z-40 border-b border-white/10 text-white shadow-xl shadow-black/30">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-teal-400/80 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(10,157,143,0.10),transparent_70%)]" />

      <div className="container relative mx-auto px-3 py-2.5 sm:px-4">
        <div className="flex items-center justify-between gap-2 lg:gap-4">

          <Link to="/" className="group flex items-center gap-2.5 transition-transform hover:scale-[1.02]">
            <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 shadow-lg shadow-teal-900/60 ring-1 ring-white/20 sm:h-10 sm:w-10">
              <img src={appLogo} alt="UNITRADE" className="h-7 w-7 rounded-lg object-cover sm:h-9 sm:w-9" />
            </span>
            <div className="hidden md:block">
              <h1 className="font-sora text-lg font-extrabold leading-none tracking-tight text-white">UNITRADE</h1>
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-teal-300/70">{t('brand.universities', 'Campus Marketplace')}</p>
            </div>
          </Link>

          <nav className="flex items-center justify-end gap-1 sm:gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className={cn('h-8 rounded-xl px-2 sm:h-9 sm:px-3 text-xs font-medium', isActive('/') ? activeClass : inactiveClass)}>
              <Home className="h-3.5 w-3.5 sm:mr-1.5" /><span className="hidden sm:inline">{t('nav.home', 'Home')}</span>
            </Button>

            <Button variant="ghost" size="sm" onClick={() => navigate('/marketplace')} className={cn('h-8 rounded-xl px-2 sm:h-9 sm:px-3 text-xs font-medium', isActive('/marketplace') ? activeClass : inactiveClass)}>
              <ShoppingBag className="h-3.5 w-3.5 sm:mr-1.5" /><span className="hidden sm:inline">{t('nav.marketplace', 'Marketplace')}</span>
            </Button>

            <Button variant="ghost" size="sm" onClick={() => navigate('/ai-assistant')} className={cn('h-8 rounded-xl px-2 sm:h-9 sm:px-3 text-xs font-medium', isActive('/ai-assistant') ? activeClass : inactiveClass)}>
              <Sparkles className="h-3.5 w-3.5 sm:mr-1.5 text-teal-300" /><span className="hidden sm:inline text-teal-200">Sasha AI</span>
            </Button>

            {isAuthenticated ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate(dashboardPath)} className={cn('h-8 rounded-xl px-2 sm:h-9 sm:px-3 text-xs font-medium', isDashboardArea ? activeClass : inactiveClass)}>
                  <LayoutDashboard className="h-3.5 w-3.5 sm:mr-1.5" /><span className="hidden sm:inline">{t('nav.dashboard', 'Dashboard')}</span>
                </Button>

                {currentUser?.role !== 'admin' && currentUser?.userType === 'seller' && (
                  <Button variant="ghost" size="sm" onClick={() => navigate('/add-listing')} className={cn('hidden md:flex h-9 rounded-xl px-3 text-xs font-medium', isActive('/add-listing') ? activeClass : inactiveClass)}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" />{t('nav.listItem', 'List Item')}
                  </Button>
                )}

                {currentUser?.userType === 'buyer' && (
                  <Button variant="ghost" size="sm" onClick={() => navigate('/favorites')} className={cn('hidden md:flex h-9 rounded-xl px-3 text-xs font-medium', isActive('/favorites') ? activeClass : inactiveClass)}>
                    <Heart className="h-3.5 w-3.5 mr-1.5" />{t('nav.favorites', 'Favorites')}
                  </Button>
                )}

                <Button variant="ghost" size="sm" onClick={() => navigate('/messages')} className={cn('relative h-8 w-8 rounded-xl p-0 sm:h-9 sm:w-9', isActive('/messages') ? activeClass : inactiveClass)}>
                  <MessageSquare className="h-4 w-4" />
                </Button>

                {currentUser?.role === 'admin' || currentUser?.userType === 'buyer' || currentUser?.userType === 'seller' ? (
                  <button
                    type="button"
                    onClick={() => navigate(profilePath)}
                    className={cn('flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-2 py-1.5 text-white transition-all hover:bg-white/20', isActive(profilePath) && 'ring-1 ring-white/30')}
                  >
                    <Avatar className="h-6 w-6 ring-1 ring-teal-400/50">
                      {currentUser?.profilePicture ? <AvatarImage src={currentUser.profilePicture} alt={currentUser.name} /> : null}
                      <AvatarFallback className="bg-teal-600 text-xs font-bold text-white">{currentUser?.name?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>
                    <span className="hidden md:inline max-w-[100px] truncate text-xs font-medium">{currentUser?.name}</span>
                  </button>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className={cn('h-8 rounded-xl border border-white/20 px-1.5 sm:h-9 sm:px-2', isActive(profilePath) ? activeClass : inactiveClass)}>
                        <Avatar className="h-6 w-6">
                          {currentUser?.profilePicture ? <AvatarImage src={currentUser.profilePicture} alt={currentUser.name} /> : null}
                          <AvatarFallback className="bg-teal-600 text-xs font-bold text-white">{currentUser?.name?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                        </Avatar>
                        <span className="hidden md:inline max-w-[100px] truncate text-xs ml-1">{currentUser?.name}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 rounded-2xl border-0 shadow-2xl">
                      <DropdownMenuItem onClick={() => navigate(currentUser?.userType === 'buyer' ? '/buyer/dashboard' : '/dashboard')}><LayoutDashboard className="h-4 w-4 mr-2 text-teal-600" />{t('nav.dashboard', 'My Dashboard')}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(currentUser?.userType === 'buyer' ? '/buyer/profile' : `/profile/${currentUser?.id}`)}><User className="h-4 w-4 mr-2 text-teal-600" />{t('nav.profile', 'My Profile')}</DropdownMenuItem>
                      {currentUser?.userType === 'buyer' && (<>
                        <DropdownMenuItem onClick={() => navigate('/buyer/orders')}><ShoppingBag className="h-4 w-4 mr-2" />{t('nav.orders', 'My Orders')}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/buyer/rentals')}><Package className="h-4 w-4 mr-2" />{t('nav.rentals', 'My Rentals')}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/buyer/payments')}><CreditCard className="h-4 w-4 mr-2" />{t('nav.paymentHistory', 'Payment History')}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/buyer/notifications')}><Bell className="h-4 w-4 mr-2" />{t('nav.notifications', 'Notifications')}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/buyer/recently-viewed')}><Eye className="h-4 w-4 mr-2" />{t('nav.recentlyViewed', 'Recently Viewed')}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/buyer/disputes')}><ShieldAlert className="h-4 w-4 mr-2" />{t('nav.disputes', 'Dispute Center')}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/buyer/report')}><Flag className="h-4 w-4 mr-2" />{t('nav.reportProblem', 'Report Problem')}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/buyer/settings')}><Settings className="h-4 w-4 mr-2" />{t('nav.settings', 'Settings')}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/buyer/help')}><CircleHelp className="h-4 w-4 mr-2" />{t('nav.help', 'Help & Support')}</DropdownMenuItem>
                      </>)}
                      {currentUser?.userType === 'seller' && (<>
                        <DropdownMenuItem onClick={() => navigate('/seller/manage-listings')}><Package className="h-4 w-4 mr-2" />{t('nav.manageListings', 'Manage Listings')}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/seller/orders')}><ShoppingBag className="h-4 w-4 mr-2" />{t('nav.orders', 'Orders')}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/seller/rentals')}><Package className="h-4 w-4 mr-2" />{t('nav.rentals', 'Rentals')}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/seller/notifications')}><Bell className="h-4 w-4 mr-2" />{t('nav.notifications', 'Notifications')}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/seller/settings')}><Settings className="h-4 w-4 mr-2" />{t('nav.settings', 'Settings')}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/seller/help')}><CircleHelp className="h-4 w-4 mr-2" />{t('nav.help', 'Help & Support')}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/seller/reports')}><Flag className="h-4 w-4 mr-2" />{t('nav.reportProblem', 'Report Problem')}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/seller/disputes')}><ShieldAlert className="h-4 w-4 mr-2" />{t('nav.disputes', 'Disputes')}</DropdownMenuItem>
                      </>)}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout} variant="destructive"><LogOut className="h-4 w-4 mr-2" />{t('nav.logout', 'Logout')}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                <Button variant="ghost" size="sm" onClick={handleLogout} className="hidden text-teal-100/70 hover:bg-white/10 hover:text-white md:flex text-xs rounded-xl">
                  <LogOut className="h-3.5 w-3.5 mr-1.5" />{t('nav.logout', 'Logout')}
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className={cn('text-xs rounded-xl px-3', isActive('/login') ? activeClass : 'text-teal-100/80 hover:bg-white/10 hover:text-white')} onClick={() => navigate('/login')}>
                  {t('auth.login', 'Login')}
                </Button>
                <Button size="sm" className="rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 px-4 text-xs font-semibold text-white shadow-md shadow-teal-900/40 hover:from-teal-400 hover:to-teal-500 border-0 transition-all" onClick={() => navigate('/register')}>
                  {t('auth.signup', 'Sign Up')}
                </Button>
              </div>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 rounded-xl p-0 text-teal-100/70 hover:bg-white/10 hover:text-white max-[420px]:hidden sm:h-9 sm:w-auto sm:gap-1.5 sm:px-2 text-xs">
                  <Languages className="h-3.5 w-3.5" /><span className="hidden sm:inline">{language.toUpperCase()}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 rounded-2xl">
                <DropdownMenuItem onClick={() => setLanguage('en')} className="flex items-center justify-between">
                  <span>{t('language.en', 'English')}</span>{language === 'en' && <Check className="h-4 w-4 text-teal-600" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLanguage('fr')} className="flex items-center justify-between">
                  <span>{t('language.fr', 'French')}</span>{language === 'fr' && <Check className="h-4 w-4 text-teal-600" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <ThemeToggle />
          </nav>
        </div>
      </div>
    </header>
  );
}
