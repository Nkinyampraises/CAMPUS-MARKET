import { ComponentType, ReactNode, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  Building2,
  Clock3,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Settings,
  Star,
  UserRound,
  X,
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentPath = location.pathname;

  useEffect(() => {
    setSidebarOpen(false);
  }, [currentPath]);

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
          ? 'bg-[#1FAF9A] text-[#053f3b]'
          : item.tone === 'danger'
            ? 'text-[#ff8c98] hover:bg-[#0b3f3f] hover:text-[#ffd3d9]'
            : 'text-[#b6ddd2] hover:bg-[#0b3f3f] hover:text-[#ebfff8]',
      )}
    >
      <item.icon
        className={cn(
          'h-[18px] w-[18px] shrink-0',
          item.active
            ? 'text-[#053f3b]'
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
        <div className="flex items-center justify-between bg-[#0F4C4C] px-4 py-3 text-white lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold">Admin Menu</span>
          <div className="h-9 w-9" />
        </div>

        <div
          className={cn(
            'fixed inset-0 z-40 lg:hidden',
            sidebarOpen ? 'visible' : 'invisible',
          )}
        >
          <button
            type="button"
            className={cn(
              'absolute inset-0 bg-black/40 transition-opacity',
              sidebarOpen ? 'opacity-100' : 'opacity-0',
            )}
            aria-label="Close menu overlay"
            onClick={() => setSidebarOpen(false)}
          />
          <nav
            className={cn(
              'absolute left-0 top-0 h-full w-[260px] bg-[#0F4C4C] shadow-xl transition-transform',
              sidebarOpen ? 'translate-x-0' : '-translate-x-full',
            )}
          >
            <div className="flex items-center justify-between border-b border-[#0b3f3f] px-4 py-3 text-white">
              <span className="text-sm font-semibold">Admin Menu</span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1.5 p-3">{adminItems.map(renderItem)}</div>
            <div className="border-t border-[#0b3f3f]" />
            <div className="space-y-1.5 p-3">{accountItems.map(renderItem)}</div>
          </nav>
        </div>

        <aside className="hidden lg:block lg:w-[248px] lg:shrink-0">
          <nav className="h-full bg-[#0F4C4C]">
            <div className="space-y-1.5 p-3">{adminItems.map(renderItem)}</div>
            <div className="border-t border-[#0b3f3f]" />
            <div className="space-y-1.5 p-3">{accountItems.map(renderItem)}</div>
          </nav>
        </aside>

        <section className="min-w-0 flex-1">{children}</section>
      </div>
    </div>
  );
}
