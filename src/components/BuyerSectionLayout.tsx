import { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  CircleHelp,
  CreditCard,
  Eye,
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

type BuyerSectionLayoutProps = {
  children: ReactNode;
};

export function BuyerSectionLayout({ children }: BuyerSectionLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { t } = useLanguage();
  const currentPath = location.pathname;

  const buyerItems: DashboardNavItem[] = [
    {
      id: 'dashboard',
      label: t('nav.dashboard', 'My Dashboard'),
      icon: LayoutDashboard,
      onClick: () => navigate('/buyer/dashboard'),
      active: currentPath === '/buyer/dashboard' || currentPath === '/dashboard',
    },
    {
      id: 'profile',
      label: t('nav.profile', 'My Profile'),
      icon: UserRound,
      onClick: () => navigate('/buyer/profile'),
      active: currentPath === '/buyer/profile' || currentPath.startsWith('/profile/'),
    },
    {
      id: 'orders',
      label: t('nav.orders', 'My Orders'),
      icon: ReceiptText,
      onClick: () => navigate('/buyer/orders'),
      active: currentPath.startsWith('/buyer/orders'),
    },
    {
      id: 'rentals',
      label: t('nav.rentals', 'My Rentals'),
      icon: Package,
      onClick: () => navigate('/buyer/rentals'),
      active: currentPath.startsWith('/buyer/rentals') || currentPath.startsWith('/buyer/rental-details'),
    },
    {
      id: 'payments',
      label: t('nav.paymentHistory', 'Payment History'),
      icon: CreditCard,
      onClick: () => navigate('/buyer/payments'),
      active: currentPath.startsWith('/buyer/payments') || currentPath.startsWith('/buyer/receipt'),
    },
    {
      id: 'notifications',
      label: t('nav.notifications', 'Notifications'),
      icon: Bell,
      onClick: () => navigate('/buyer/notifications'),
      active: currentPath.startsWith('/buyer/notifications'),
    },
    {
      id: 'recently-viewed',
      label: t('nav.recentlyViewed', 'Recently Viewed'),
      icon: Eye,
      onClick: () => navigate('/buyer/recently-viewed'),
      active: currentPath.startsWith('/buyer/recently-viewed'),
    },
    {
      id: 'disputes',
      label: t('nav.disputes', 'Dispute Center'),
      icon: ShieldAlert,
      onClick: () => navigate('/buyer/disputes'),
      active: currentPath.startsWith('/buyer/disputes'),
    },
    {
      id: 'report',
      label: t('nav.reportProblem', 'Report Problem'),
      icon: Flag,
      onClick: () => navigate('/buyer/report'),
      active: currentPath.startsWith('/buyer/report'),
    },
    {
      id: 'settings',
      label: t('nav.settings', 'Settings'),
      icon: Settings,
      onClick: () => navigate('/buyer/settings'),
      active: currentPath.startsWith('/buyer/settings'),
    },
    {
      id: 'help',
      label: t('nav.help', 'Help & Support'),
      icon: CircleHelp,
      onClick: () => navigate('/buyer/help'),
      active: currentPath.startsWith('/buyer/help'),
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
    <DashboardSidebarShell
      menuLabel={t('nav.buyerDashboard', 'Buyer Dashboard')}
      items={buyerItems}
      accountItems={accountItems}
      navHeader={
        <div className="border-b border-sidebar-border px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-widest text-sidebar-foreground/70">
            {t('nav.buyerDashboard', 'Buyer Dashboard')}
          </p>
        </div>
      }
    >
      {children}
    </DashboardSidebarShell>
  );
}
