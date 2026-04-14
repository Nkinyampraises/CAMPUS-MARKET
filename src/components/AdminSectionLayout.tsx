import { ComponentType, ReactNode } from 'react';
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
import { cn } from '@/app/components/ui/utils';
import { useAuth } from '@/contexts/AuthContext';

type AdminSectionLayoutProps = {
  children: ReactNode;
};

type SidebarItem = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
  active: boolean;
  tone?: 'default' | 'danger';
};

export function AdminSectionLayout({ children }: AdminSectionLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const currentPath = location.pathname;

  const adminItems: SidebarItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
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
      label: 'Account Approvals',
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
      label: 'Inbox',
      icon: Bell,
      onClick: () => navigate('/admin/inbox'),
      active: currentPath.startsWith('/admin/inbox'),
    },
    {
      id: 'reviews',
      label: 'Reviews',
      icon: Star,
      onClick: () => navigate('/admin/reviews'),
      active: currentPath.startsWith('/admin/reviews'),
    },
    {
      id: 'universities',
      label: 'Universities',
      icon: Building2,
      onClick: () => navigate('/admin/universities'),
      active: currentPath.startsWith('/admin/universities'),
    },
    {
      id: 'categories',
      label: 'Categories',
      icon: ListChecks,
      onClick: () => navigate('/admin/categories'),
      active: currentPath.startsWith('/admin/categories'),
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      onClick: () => navigate('/admin/analytics'),
      active: currentPath.startsWith('/admin/analytics'),
    },
  ];

  const accountItems: SidebarItem[] = [
    {
      id: 'logout',
      label: 'Logout',
      icon: LogOut,
      onClick: () => {
        logout();
        navigate('/login');
      },
      active: false,
      tone: 'danger',
    },
  ];

  const renderItem = (item: SidebarItem) => (
    <button
      key={item.id}
      type="button"
      onClick={item.onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-3.5 py-2.5 text-left text-[0.97rem] font-medium transition-colors duration-200',
        item.active
          ? 'bg-[#0c6a5a] text-[#e9fff7]'
          : item.tone === 'danger'
            ? 'text-[#ff8c98] hover:bg-[#0f4f46] hover:text-[#ffd3d9]'
            : 'text-[#b6ddd2] hover:bg-[#0a5449] hover:text-[#ebfff8]',
      )}
    >
      <item.icon
        className={cn(
          'h-[18px] w-[18px] shrink-0',
          item.active
            ? 'text-[#e9fff7]'
            : item.tone === 'danger'
              ? 'text-[#ff8c98]'
              : 'text-[#9fcec2]',
        )}
      />
      <span>{item.label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#eef4f1]">
      <div className="flex min-h-screen w-full flex-col lg:flex-row">
        <aside className="w-full lg:w-[248px] lg:shrink-0">
          <nav className="h-full bg-[#013b36]">
            <div className="space-y-1.5 p-3">{adminItems.map(renderItem)}</div>
            <div className="border-t border-[#0e5a51]" />
            <div className="space-y-1.5 p-3">{accountItems.map(renderItem)}</div>
          </nav>
        </aside>

        <section className="min-w-0 flex-1">{children}</section>
      </div>
    </div>
  );
}
