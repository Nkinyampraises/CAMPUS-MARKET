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
} from 'lucide-react';
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
  const activeHeaderClass = 'bg-[#05B43D] text-white hover:bg-[#018F2D]';
  const inactiveHeaderClass = 'text-[#4A4A4A] hover:bg-[#018F2D] hover:text-white';

  return (
    <header className="sticky top-0 z-40 border-b border-[#DDE3E2] bg-[#FFFFFF] text-[#111111] shadow-sm">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-transparent via-[#05B43D] to-transparent" />
      <div className="w-full px-3 py-1.5 sm:px-4 sm:py-2">
        <div className="flex items-center gap-2 lg:gap-4">
          {/* Logo flush to the left edge */}
          <Link to="/" className="flex shrink-0 items-center gap-2 transition-transform hover:scale-[1.01]">
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-[#05B43D] bg-[#e6f9ee] shadow-sm sm:h-11 sm:w-11">
              <img src={appLogo} alt="UNITRADE" className="h-8 w-8 rounded-full object-cover sm:h-10 sm:w-10" />
            </span>
            <div className="hidden sm:block">
              <p className="text-[1.35rem] font-extrabold leading-tight text-[#05B43D]">UNITRADE</p>
              <p className="mt-1.5 text-[11px] font-medium text-[#8A8A8A]">{t('brand.universities', 'Cameroon Universities')}</p>
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
                      isActive('/add-listing') ? activeHeaderClass : 'text-[#4A4A4A] hover:bg-[#e6f9ee] hover:text-[#05B43D]',
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
                      isActive('/favorites') ? activeHeaderClass : 'text-[#4A4A4A] hover:bg-[#e6f9ee] hover:text-[#05B43D]',
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
                      : 'text-[#4A4A4A] hover:bg-[#e6f9ee] hover:text-[#05B43D]',
                  )}
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>

                {currentUser?.role === 'admin' || currentUser?.userType === 'buyer' || currentUser?.userType === 'seller' ? (
                  <button
                    type="button"
                    onClick={() => navigate(profilePath)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border border-[#DDE3E2] px-1.5 py-1 text-[#111111] transition-colors hover:border-[#05B43D]',
                      isActive(profilePath) ? activeHeaderClass : 'hover:bg-[#018F2D] hover:text-white',
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
                          'h-8 rounded-full border border-[#DDE3E2] px-1.5 sm:h-9 sm:px-2',
                          isActive(profilePath)
                            ? activeHeaderClass
                            : 'text-[#4A4A4A] hover:bg-[#e6f9ee] hover:text-[#05B43D]',
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
                  className="hidden text-[#4A4A4A] hover:bg-[#018F2D] hover:text-white md:flex"
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
                    isActive('/login') ? activeHeaderClass : 'text-[#4A4A4A] hover:bg-[#018F2D] hover:text-white',
                  )}
                  onClick={() => navigate('/login')}
                >
                  {t('auth.login', 'Login')}
                </Button>
                <Button
                  size="sm"
                  className={cn(
                    'rounded-full px-2 sm:px-4',
                    isActive('/register') ? activeHeaderClass : 'bg-[#05B43D] text-white hover:bg-[#018F2D]',
                  )}
                  onClick={() => navigate('/register')}
                >
                  {t('auth.signup', 'Sign Up')}
                </Button>
              </div>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 rounded-full p-0 text-[#4A4A4A] hover:bg-[#018F2D] hover:text-white max-[420px]:hidden sm:h-9 sm:w-auto sm:gap-1.5 sm:px-2"
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
