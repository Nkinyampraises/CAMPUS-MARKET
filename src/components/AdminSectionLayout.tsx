import { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  Building2,
  Clock3,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Settings,
  Star,
  UserRound,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { DashboardSidebarShell, DashboardNavItem } from '@/components/DashboardSidebarShell';

type AdminSectionLayoutProps = {
  children: ReactNode;
};

export function AdminSectionLayout({ children }: AdminSectionLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { t } = useLanguage();

  const currentPath = location.pathname;

  const adminItems: DashboardNavItem[] = [
    {
      id: 'dashboard',
      label: t('nav.dashboard', 'Dashboard'),
      icon: LayoutDashboard,
      onClick: () => navigate('/admin'),
      active: currentPath === '/admin',
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: UserRound,
      onClick: () => navigate('/admin/profile'),
      active: currentPath.startsWith('/admin/profile'),
    },
    {
      id: 'account-approvals',
      label: t('nav.accountApprovals', 'Account Approvals'),
      icon: Clock3,
      onClick: () => navigate('/admin-approvals'),
      active: currentPath.startsWith('/admin-approvals'),
    },
    {
      id: 'admin-panel',
      label: 'Admin Panel',
      icon: Settings,
      onClick: () => navigate('/admin/user-management'),
      active: currentPath.startsWith('/admin/user-management') || currentPath.startsWith('/admin/user-details'),
    },
    {
      id: 'inbox',
      label: t('nav.inbox', 'Inbox'),
      icon: Bell,
      onClick: () => navigate('/admin/inbox'),
      active: currentPath.startsWith('/admin/inbox'),
    },
    {
      id: 'reviews',
      label: t('nav.reviews', 'Reviews'),
      icon: Star,
      onClick: () => navigate('/admin/reviews'),
      active: currentPath.startsWith('/admin/reviews'),
    },
    {
      id: 'universities',
      label: t('nav.universities', 'Universities'),
      icon: Building2,
      onClick: () => navigate('/admin/universities'),
      active: currentPath.startsWith('/admin/universities'),
    },
    {
      id: 'categories',
      label: t('nav.categories', 'Categories'),
      icon: ListChecks,
      onClick: () => navigate('/admin/categories'),
      active: currentPath.startsWith('/admin/categories'),
    },
    {
      id: 'analytics',
      label: t('nav.analytics', 'Analytics'),
      icon: BarChart3,
      onClick: () => navigate('/admin/analytics'),
      active: currentPath.startsWith('/admin/analytics'),
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
    <DashboardSidebarShell menuLabel="Admin Menu" items={adminItems} accountItems={accountItems}>
      {children}
    </DashboardSidebarShell>
  );
}
