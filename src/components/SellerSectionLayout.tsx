import { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  CircleHelp,
  Flag,
  LayoutDashboard,
  LogOut,
  Package,
  ReceiptText,
  Settings,
  ShieldAlert,
  UserRound,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardSidebarShell, DashboardNavItem } from '@/components/DashboardSidebarShell';

type SellerSectionLayoutProps = {
  children: ReactNode;
};

export function SellerSectionLayout({ children }: SellerSectionLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { t } = useLanguage();
  const currentPath = location.pathname;

  const sellerItems: DashboardNavItem[] = [
    {
      id: 'dashboard',
      label: t('nav.dashboard', 'My Dashboard'),
      icon: LayoutDashboard,
      onClick: () => navigate('/seller/dashboard'),
      active: currentPath === '/seller/dashboard' || currentPath === '/dashboard',
    },
    {
      id: 'profile',
      label: t('nav.profile', 'My Profile'),
      icon: UserRound,
      onClick: () => navigate('/seller/profile'),
      active: currentPath.startsWith('/seller/profile') || currentPath.startsWith('/profile/'),
    },
    {
      id: 'manage-listings',
      label: t('nav.manageListings', 'Manage Listings'),
      icon: Package,
      onClick: () => navigate('/seller/manage-listings'),
      active: currentPath.startsWith('/seller/manage-listings') || currentPath.startsWith('/seller/edit-listing'),
    },
    {
      id: 'orders',
      label: t('nav.orders', 'Orders'),
      icon: ReceiptText,
      onClick: () => navigate('/seller/orders'),
      active: currentPath.startsWith('/seller/orders') || currentPath.startsWith('/seller/order-details'),
    },
    {
      id: 'rentals',
      label: t('nav.rentals', 'Rentals'),
      icon: Package,
      onClick: () => navigate('/seller/rentals'),
      active: currentPath.startsWith('/seller/rentals'),
    },
    {
      id: 'notifications',
      label: t('nav.notifications', 'Notifications'),
      icon: Bell,
      onClick: () => navigate('/seller/notifications'),
      active: currentPath.startsWith('/seller/notifications'),
    },
    {
      id: 'settings',
      label: t('nav.settings', 'Settings'),
      icon: Settings,
      onClick: () => navigate('/seller/settings'),
      active: currentPath.startsWith('/seller/settings'),
    },
    {
      id: 'help',
      label: t('nav.help', 'Help & Support'),
      icon: CircleHelp,
      onClick: () => navigate('/seller/help'),
      active: currentPath.startsWith('/seller/help'),
    },
    {
      id: 'report',
      label: t('nav.reportProblem', 'Report Problem'),
      icon: Flag,
      onClick: () => navigate('/seller/reports'),
      active: currentPath.startsWith('/seller/reports'),
    },
    {
      id: 'disputes',
      label: t('nav.disputes', 'Disputes'),
      icon: ShieldAlert,
      onClick: () => navigate('/seller/disputes'),
      active: currentPath.startsWith('/seller/disputes'),
    },
  ];

  const accountItems: DashboardNavItem[] = [
    {
      id: 'logout',
      label: t('nav.logout', 'Logout'),
      icon: LogOut,
      onClick: () => {
        logout();
        navigate('/login');
      },
      active: false,
      tone: 'danger',
    },
  ];

  return (
    <DashboardSidebarShell menuLabel="Seller Menu" items={sellerItems} accountItems={accountItems}>
      {children}
    </DashboardSidebarShell>
  );
}
