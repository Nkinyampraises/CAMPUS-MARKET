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
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/ThemeToggle';

export function Header() {
  const { currentUser, logout, isAuthenticated } = useAuth();
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
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="h-10 w-10 bg-green-600 rounded-lg flex items-center justify-center">
              <ShoppingBag className="h-6 w-6 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-foreground">CampusMarket</h1>
              <p className="text-xs text-muted-foreground">Cameroon Universities</p>
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
              <span className="hidden sm:inline">Home</span>
            </Button>

            <Button
              variant={isActive('/marketplace') ? 'default' : 'ghost'}
              size="sm"
              onClick={() => navigate('/marketplace')}
              className={isActive('/marketplace') ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              <ShoppingBag className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Marketplace</span>
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
                    List Item
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
                    Favorites
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
                      My Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/profile/${currentUser?.id}`)}>
                      <User className="h-4 w-4 mr-2" />
                      My Profile
                    </DropdownMenuItem>
                    {currentUser?.role !== 'admin' && currentUser?.userType === 'buyer' && (
                      <>
                        <DropdownMenuItem onClick={() => navigate('/buyer/orders')}>
                          <ShoppingBag className="h-4 w-4 mr-2" />
                          My Orders
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/buyer/rentals')}>
                          <Package className="h-4 w-4 mr-2" />
                          My Rentals
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/buyer/payments')}>
                          <CreditCard className="h-4 w-4 mr-2" />
                          Payment History
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/buyer/notifications')}>
                          <Bell className="h-4 w-4 mr-2" />
                          Notifications
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/buyer/recently-viewed')}>
                          <Eye className="h-4 w-4 mr-2" />
                          Recently Viewed
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/buyer/disputes')}>
                          <ShieldAlert className="h-4 w-4 mr-2" />
                          Dispute Center
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/buyer/report')}>
                          <Flag className="h-4 w-4 mr-2" />
                          Report Problem
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/buyer/settings')}>
                          <Settings className="h-4 w-4 mr-2" />
                          Settings
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/buyer/help')}>
                          <CircleHelp className="h-4 w-4 mr-2" />
                          Help & Support
                        </DropdownMenuItem>
                      </>
                    )}
                    {currentUser?.role !== 'admin' && currentUser?.userType === 'seller' && (
                      <>
                        <DropdownMenuItem onClick={() => navigate('/seller/manage-listings')}>
                          <Package className="h-4 w-4 mr-2" />
                          Manage Listings
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/seller/orders')}>
                          <ShoppingBag className="h-4 w-4 mr-2" />
                          Orders
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/seller/rentals')}>
                          <Package className="h-4 w-4 mr-2" />
                          Rentals
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/seller/notifications')}>
                          <Bell className="h-4 w-4 mr-2" />
                          Notifications
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/seller/settings')}>
                          <Settings className="h-4 w-4 mr-2" />
                          Settings
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/seller/help')}>
                          <CircleHelp className="h-4 w-4 mr-2" />
                          Help & Support
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/seller/reports')}>
                          <Flag className="h-4 w-4 mr-2" />
                          Report Problem
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/seller/disputes')}>
                          <ShieldAlert className="h-4 w-4 mr-2" />
                          Disputes
                        </DropdownMenuItem>
                      </>
                    )}
                    {currentUser?.role === 'admin' && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => navigate('/admin-approvals')}>
                          <Clock className="h-4 w-4 mr-2" />
                          Account Approvals
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/admin')}>
                          <Settings className="h-4 w-4 mr-2" />
                          Admin Panel
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/admin/inbox')}>
                          <Bell className="h-4 w-4 mr-2" />
                          Inbox
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/admin/reviews')}>
                          <Star className="h-4 w-4 mr-2" />
                          Reviews
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/admin/universities')}>
                          <Building2 className="h-4 w-4 mr-2" />
                          Universities
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/admin/categories')}>
                          <ListTree className="h-4 w-4 mr-2" />
                          Categories
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/admin/analytics')}>
                          <BarChart3 className="h-4 w-4 mr-2" />
                          Analytics
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
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
                  Login
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate('/register')}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Sign Up
                </Button>
              </div>
            )}

            <ThemeToggle />
          </nav>
        </div>
      </div>
    </header>
  );
}
