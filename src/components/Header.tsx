import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar';
import {
  ShoppingBag,
  Package,
  CreditCard,
  Plus,
  MessageSquare,
  User,
  LogOut,
  Home,
  LayoutDashboard,
  Settings,
  Heart,
  Bell,
  CircleHelp,
  Eye,
  Flag,
  ShieldAlert,
  Languages,
  Check,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
  const { canInstall, isIos, isInstalled, isCapacitorApp, promptInstall } = usePwaInstall();

  // Always show an Install button while the app isn't installed (and not running
  // inside the Capacitor native shell). Clicking it triggers the native prompt
  // when available, otherwise shows platform-appropriate instructions.
  const showInstallButton = !isInstalled && !isCapacitorApp;

  const handleInstallClick = async () => {
    if (canInstall) {
      const outcome = await promptInstall();
      if (outcome === 'accepted') {
        toast.success(t('pwa.installing', 'Installing UNITRADE…'));
        return;
      }
      if (outcome !== 'unavailable') return; // user dismissed the native dialog
    }

    if (isIos) {
      toast(t('pwa.ios_install_hint', 'Tap the Share icon, then "Add to Home Screen" to install UNITRADE.'), { duration: 9000 });
    } else {
      toast(
        t('pwa.desktop_install_hint', 'Open your browser menu and choose "Install UNITRADE" / "Add to Home screen". The button installs automatically once your browser marks the app installable.'),
        { duration: 9000 },
      );
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };
  const isAdminArea =
    location.pathname === '/admin' ||
    location.pathname.startsWith('/admin/') ||
    location.pathname.startsWith('/admin-');
  const isBuyerArea = location.pathname === '/buyer/dashboard' || location.pathname.startsWith('/buyer/');
  const isSellerArea = location.pathname === '/seller/dashboard' || location.pathname.startsWith('/seller/');
  const dashboardPath =
    currentUser?.role === 'admin'
      ? '/admin'
      : currentUser?.userType === 'buyer'
        ? '/buyer/dashboard'
        : '/seller/dashboard';
  const isDashboardArea =
    currentUser?.role === 'admin'
      ? isAdminArea
      : currentUser?.userType === 'buyer'
        ? isBuyerArea
        : isSellerArea || location.pathname === '/dashboard';
  const profilePath =
    currentUser?.role === 'admin'
      ? '/admin/profile'
      : currentUser?.userType === 'buyer'
        ? '/buyer/profile'
        : '/seller/profile';
  const activeHeaderClass = 'bg-primary text-primary-foreground hover:bg-primary-strong';
  const inactiveHeaderClass = 'text-muted-foreground hover:bg-primary-strong hover:text-primary-foreground';

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card text-foreground shadow-card">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-transparent via-primary to-transparent" />
      <div className="w-full px-3 py-1.5 sm:px-4 sm:py-2">
        <div className="flex items-center gap-2 lg:gap-4">
          {/* Logo flush to the left edge */}
          <Link to="/" className="flex shrink-0 items-center gap-3 transition-transform hover:scale-[1.01]">
            <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-primary bg-primary-soft shadow-card sm:h-14 sm:w-14">
              <img src={appLogo} alt="UNITRADE" className="h-11 w-11 rounded-full object-cover sm:h-13 sm:w-13" />
            </span>
            <div className="hidden sm:flex sm:flex-col sm:gap-0.5">
              <p className="text-[1.6rem] font-extrabold leading-tight text-primary">UNITRADE</p>
              <p className="text-[13px] font-medium text-muted-foreground">{t('brand.universities', 'Cameroon Universities')}</p>
            </div>
          </Link>

          {/* Nav items pushed to the right */}
          <nav className="ml-auto flex items-center gap-1 sm:gap-1.5 lg:gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className={cn(
                'h-8 w-8 rounded-full p-0 sm:h-9 sm:w-auto sm:px-4',
                isActive('/')
                  ? activeHeaderClass
                  : inactiveHeaderClass,
              )}
            >
              <Home className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('nav.home', 'Home')}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/marketplace')}
              className={cn(
                'h-8 w-8 rounded-full p-0 sm:h-9 sm:w-auto sm:px-4',
                isActive('/marketplace')
                  ? activeHeaderClass
                  : inactiveHeaderClass,
              )}
            >
              <ShoppingBag className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('nav.marketplace', 'Marketplace')}</span>
            </Button>

            {isAuthenticated ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(dashboardPath)}
                  className={cn(
                    'h-8 w-8 rounded-full p-0 sm:h-9 sm:w-auto sm:px-4',
                    isDashboardArea
                      ? activeHeaderClass
                      : inactiveHeaderClass,
                  )}
                >
                  <LayoutDashboard className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">{t('nav.dashboard', 'Dashboard')}</span>
                </Button>

                {currentUser?.role !== 'admin' && currentUser?.userType === 'seller' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/add-listing')}
                    className={cn(
                      'hidden md:flex',
                      isActive('/add-listing') ? activeHeaderClass : 'text-muted-foreground hover:bg-primary-soft hover:text-primary',
                    )}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('nav.listItem', 'List Item')}
                  </Button>
                )}

                {currentUser?.userType === 'buyer' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/favorites')}
                    className={cn(
                      'hidden md:flex',
                      isActive('/favorites') ? activeHeaderClass : 'text-muted-foreground hover:bg-primary-soft hover:text-primary',
                    )}
                  >
                    <Heart className="h-4 w-4 mr-2" />
                    {t('nav.favorites', 'Favorites')}
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/messages')}
                  className={cn(
                    'relative h-8 w-8 rounded-full p-0 sm:h-9 sm:w-9',
                    isActive('/messages')
                      ? activeHeaderClass
                      : 'text-muted-foreground hover:bg-primary-soft hover:text-primary',
                  )}
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>

                {currentUser?.role === 'admin' || currentUser?.userType === 'buyer' || currentUser?.userType === 'seller' ? (
                  <button
                    type="button"
                    onClick={() => navigate(profilePath)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border border-border px-1.5 py-1 text-foreground transition-colors hover:border-primary',
                      isActive(profilePath) ? activeHeaderClass : 'hover:bg-primary-strong hover:text-primary-foreground',
                    )}
                    title={t('nav.profile', 'My Profile')}
                  >
                    <Avatar className="h-6 w-6 sm:h-7 sm:w-7">
                      {currentUser?.profilePicture ? (
                        <AvatarImage src={currentUser.profilePicture} alt={currentUser.name} />
                      ) : null}
                      <AvatarFallback className="text-xs bg-primary/15 text-primary">
                        {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden md:inline max-w-[110px] truncate">{currentUser?.name}</span>
                  </button>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          'h-8 rounded-full border border-border px-1.5 sm:h-9 sm:px-2',
                          isActive(profilePath)
                            ? activeHeaderClass
                            : 'text-muted-foreground hover:bg-primary-soft hover:text-primary',
                        )}
                      >
                        <Avatar className="h-6 w-6 sm:h-7 sm:w-7">
                          {currentUser?.profilePicture ? (
                            <AvatarImage src={currentUser.profilePicture} alt={currentUser.name} />
                          ) : null}
                          <AvatarFallback className="text-xs bg-primary/15 text-primary">
                            {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="hidden md:inline max-w-[120px] truncate">
                          {currentUser?.name}
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 rounded-xl">
                      <DropdownMenuItem onClick={() => navigate(currentUser?.userType === 'buyer' ? '/buyer/dashboard' : '/dashboard')}>
                        <LayoutDashboard className="h-4 w-4 mr-2" />
                        {t('nav.dashboard', 'My Dashboard')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(currentUser?.userType === 'buyer' ? '/buyer/profile' : `/profile/${currentUser?.id}`)}>
                        <User className="h-4 w-4 mr-2" />
                        {t('nav.profile', 'My Profile')}
                      </DropdownMenuItem>
                      {currentUser?.userType === 'buyer' && (
                        <>
                          <DropdownMenuItem onClick={() => navigate('/buyer/orders')}>
                            <ShoppingBag className="h-4 w-4 mr-2" />
                            {t('nav.orders', 'My Orders')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate('/buyer/rentals')}>
                            <Package className="h-4 w-4 mr-2" />
                            {t('nav.rentals', 'My Rentals')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate('/buyer/payments')}>
                            <CreditCard className="h-4 w-4 mr-2" />
                            {t('nav.paymentHistory', 'Payment History')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate('/buyer/notifications')}>
                            <Bell className="h-4 w-4 mr-2" />
                            {t('nav.notifications', 'Notifications')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate('/buyer/recently-viewed')}>
                            <Eye className="h-4 w-4 mr-2" />
                            {t('nav.recentlyViewed', 'Recently Viewed')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate('/buyer/disputes')}>
                            <ShieldAlert className="h-4 w-4 mr-2" />
                            {t('nav.disputes', 'Dispute Center')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate('/buyer/report')}>
                            <Flag className="h-4 w-4 mr-2" />
                            {t('nav.reportProblem', 'Report Problem')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate('/buyer/settings')}>
                            <Settings className="h-4 w-4 mr-2" />
                            {t('nav.settings', 'Settings')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate('/buyer/help')}>
                            <CircleHelp className="h-4 w-4 mr-2" />
                            {t('nav.help', 'Help & Support')}
                          </DropdownMenuItem>
                        </>
                      )}
                      {currentUser?.userType === 'seller' && (
                        <>
                          <DropdownMenuItem onClick={() => navigate('/seller/manage-listings')}>
                            <Package className="h-4 w-4 mr-2" />
                            {t('nav.manageListings', 'Manage Listings')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate('/seller/orders')}>
                            <ShoppingBag className="h-4 w-4 mr-2" />
                            {t('nav.orders', 'Orders')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate('/seller/rentals')}>
                            <Package className="h-4 w-4 mr-2" />
                            {t('nav.rentals', 'Rentals')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate('/seller/notifications')}>
                            <Bell className="h-4 w-4 mr-2" />
                            {t('nav.notifications', 'Notifications')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate('/seller/settings')}>
                            <Settings className="h-4 w-4 mr-2" />
                            {t('nav.settings', 'Settings')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate('/seller/help')}>
                            <CircleHelp className="h-4 w-4 mr-2" />
                            {t('nav.help', 'Help & Support')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate('/seller/reports')}>
                            <Flag className="h-4 w-4 mr-2" />
                            {t('nav.reportProblem', 'Report Problem')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate('/seller/disputes')}>
                            <ShieldAlert className="h-4 w-4 mr-2" />
                            {t('nav.disputes', 'Disputes')}
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout} variant="destructive">
                        <LogOut className="h-4 w-4 mr-2" />
                        {t('nav.logout', 'Logout')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="hidden text-muted-foreground hover:bg-primary-strong hover:text-primary-foreground md:flex"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  {t('nav.logout', 'Logout')}
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'px-2 sm:px-3',
                    isActive('/login') ? activeHeaderClass : 'text-muted-foreground hover:bg-primary-strong hover:text-primary-foreground',
                  )}
                  onClick={() => navigate('/login')}
                >
                  {t('auth.login', 'Login')}
                </Button>
                <Button
                  size="sm"
                  className={cn(
                    'rounded-full px-2 sm:px-4',
                    isActive('/register') ? activeHeaderClass : 'bg-primary text-primary-foreground hover:bg-primary-strong',
                  )}
                  onClick={() => navigate('/register')}
                >
                  {t('auth.signup', 'Sign Up')}
                </Button>
              </div>
            )}

            {showInstallButton && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleInstallClick}
                title={t('pwa.install_app', 'Install App')}
                className="rounded-full border-primary/40 px-2 text-primary hover:bg-primary hover:text-primary-foreground sm:px-3"
              >
                <Download className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">{t('pwa.install', 'Install')}</span>
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 rounded-full p-0 text-muted-foreground hover:bg-primary-strong hover:text-primary-foreground max-[420px]:hidden sm:h-9 sm:w-auto sm:gap-1.5 sm:px-2"
                  title={t('language.select', 'Select language')}
                >
                  <Languages className="h-4 w-4" />
                  <span className="hidden sm:inline">{language.toUpperCase()}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 rounded-xl">
                <DropdownMenuItem onClick={() => setLanguage('en')} className="flex items-center justify-between">
                  <span>{t('language.en', 'English')}</span>
                  {language === 'en' && <Check className="h-4 w-4" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLanguage('fr')} className="flex items-center justify-between">
                  <span>{t('language.fr', 'French')}</span>
                  {language === 'fr' && <Check className="h-4 w-4" />}
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
