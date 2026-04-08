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
  Clock,
  Heart,
  Bell,
  CircleHelp,
  Eye,
  Flag,
  ShieldAlert,
  Star,
  Building2,
  ListTree,
  BarChart3,
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

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-[linear-gradient(90deg,rgba(2,44,66,0.92),rgba(3,56,66,0.9),rgba(2,44,66,0.92))] text-white backdrop-blur-xl supports-[backdrop-filter]:bg-[linear-gradient(90deg,rgba(2,44,66,0.82),rgba(3,56,66,0.78),rgba(2,44,66,0.82))] sm:bg-background/85 sm:text-foreground sm:supports-[backdrop-filter]:bg-background/70">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <div className="container mx-auto px-2 py-1.5 sm:px-4 sm:py-3">
        <div className="flex items-center justify-between gap-2 lg:gap-4">
          <Link to="/" className="group flex items-center gap-2.5 transition-transform hover:scale-[1.01]">
            <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-white/50 bg-white/90 shadow-sm dark:border-white/20 dark:bg-white/10 sm:h-12 sm:w-12 sm:rounded-2xl sm:border-white/70 sm:bg-white/85">
              <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(20,184,166,0.22),rgba(56,189,248,0.22))]" />
              <img src={appLogo} alt="UNITRADE logo" className="relative h-8 w-8 rounded-lg object-cover sm:h-10 sm:w-10 sm:rounded-xl" />
            </span>
            <div className="hidden md:block">
              <h1 className="text-xl font-bold text-foreground">UNITRADE</h1>
              <p className="text-xs text-muted-foreground">{t('brand.universities', 'Cameroon Universities')}</p>
            </div>
          </Link>

          <nav className="flex items-center justify-end gap-1 sm:gap-1.5 lg:gap-2">
            <Button
              variant={isActive('/') ? 'default' : 'ghost'}
              size="sm"
              onClick={() => navigate('/')}
              className={`${isActive('/') ? 'shadow-sm' : ''} h-8 w-8 rounded-full p-0 text-white hover:bg-white/20 sm:h-9 sm:w-auto sm:px-3 sm:text-foreground sm:hover:bg-accent`}
            >
              <Home className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('nav.home', 'Home')}</span>
            </Button>

            <Button
              variant={isActive('/marketplace') ? 'default' : 'ghost'}
              size="sm"
              onClick={() => navigate('/marketplace')}
              className={`${isActive('/marketplace') ? 'shadow-sm' : ''} h-8 w-8 rounded-full p-0 text-white hover:bg-white/20 sm:h-9 sm:w-auto sm:px-3 sm:text-foreground sm:hover:bg-accent`}
            >
              <ShoppingBag className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('nav.marketplace', 'Marketplace')}</span>
            </Button>

            {isAuthenticated ? (
              <>
                {currentUser?.userType === 'seller' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/add-listing')}
                    className="hidden md:flex"
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
                    className="hidden md:flex"
                  >
                    <Heart className="h-4 w-4 mr-2" />
                    {t('nav.favorites', 'Favorites')}
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/messages')}
                  className="relative h-8 w-8 rounded-full p-0 text-white hover:bg-white/20 sm:h-9 sm:w-9 sm:text-foreground sm:hover:bg-accent"
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 rounded-full border border-white/20 px-1.5 text-white hover:bg-white/20 sm:h-9 sm:border-transparent sm:px-2 sm:text-foreground sm:hover:border-border/70 sm:hover:bg-accent">
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
                    <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                      <LayoutDashboard className="h-4 w-4 mr-2" />
                      {t('nav.dashboard', 'My Dashboard')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/profile/${currentUser?.id}`)}>
                      <User className="h-4 w-4 mr-2" />
                      {t('nav.profile', 'My Profile')}
                    </DropdownMenuItem>
                    {currentUser?.role !== 'admin' && currentUser?.userType === 'buyer' && (
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
                    {currentUser?.role !== 'admin' && currentUser?.userType === 'seller' && (
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
                    {currentUser?.role === 'admin' && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => navigate('/admin-approvals')}>
                          <Clock className="h-4 w-4 mr-2" />
                          {t('nav.accountApprovals', 'Account Approvals')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/admin')}>
                          <Settings className="h-4 w-4 mr-2" />
                          {t('nav.adminPanel', 'Admin Panel')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/admin/inbox')}>
                          <Bell className="h-4 w-4 mr-2" />
                          {t('nav.inbox', 'Inbox')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/admin/reviews')}>
                          <Star className="h-4 w-4 mr-2" />
                          {t('nav.reviews', 'Reviews')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/admin/universities')}>
                          <Building2 className="h-4 w-4 mr-2" />
                          {t('nav.universities', 'Universities')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/admin/categories')}>
                          <ListTree className="h-4 w-4 mr-2" />
                          {t('nav.categories', 'Categories')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/admin/analytics')}>
                          <BarChart3 className="h-4 w-4 mr-2" />
                          {t('nav.analytics', 'Analytics')}
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
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-2 sm:px-3"
                  onClick={() => navigate('/login')}
                >
                  {t('auth.login', 'Login')}
                </Button>
                <Button
                  size="sm"
                  className="px-2 sm:px-3"
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
                  className="h-8 w-8 rounded-full p-0 text-white hover:bg-white/20 max-[420px]:hidden sm:h-9 sm:w-auto sm:gap-1.5 sm:px-2 sm:text-foreground sm:hover:bg-accent"
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
