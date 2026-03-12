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
    <header className="border-b border-border bg-background shadow-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src={appLogo} alt="CampusMarket logo" className="h-12 w-12 rounded-lg object-cover" />
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-foreground">CampusMarket</h1>
              <p className="text-xs text-muted-foreground">{t('brand.universities', 'Cameroon Universities')}</p>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-2">
            <Button
              variant={isActive('/') ? 'default' : 'ghost'}
              size="sm"
              onClick={() => navigate('/')}
              className={isActive('/') ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              <Home className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('nav.home', 'Home')}</span>
            </Button>

            <Button
              variant={isActive('/marketplace') ? 'default' : 'ghost'}
              size="sm"
              onClick={() => navigate('/marketplace')}
              className={isActive('/marketplace') ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              <ShoppingBag className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{t('nav.marketplace', 'Marketplace')}</span>
            </Button>

            {isAuthenticated ? (
              <>
                {/* Show "List Item" button only for sellers */}
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

                {/* Show "Favorites" button only for buyers */}
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
                  className="relative"
                >
                  <MessageSquare className="h-4 w-4" />
                  {/* Unread badge placeholder */}
                  {/* <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">3</span> */}
                </Button>

                {/* User Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <Avatar className="h-6 w-6">
                        {currentUser?.profilePicture ? (
                          <AvatarImage src={currentUser.profilePicture} alt={currentUser.name} />
                        ) : null}
                        <AvatarFallback className="text-xs bg-green-100 text-green-700">
                          {currentUser?.name?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden md:inline max-w-[100px] truncate">
                        {currentUser?.name}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
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
                    <DropdownMenuItem onClick={handleLogout} className="text-red-600">
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
                  onClick={() => navigate('/login')}
                >
                  {t('auth.login', 'Login')}
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate('/register')}
                  className="bg-green-600 hover:bg-green-700"
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
                  className="gap-1.5"
                  title={t('language.select', 'Select language')}
                >
                  <Languages className="h-4 w-4" />
                  <span className="hidden sm:inline">{language.toUpperCase()}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
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
