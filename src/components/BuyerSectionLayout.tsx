import { ComponentType, ReactNode, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  CircleHelp,
  CreditCard,
  Eye,
  Flag,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ReceiptText,
  Settings,
  ShieldAlert,
  UserRound,
  X,
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { useAuth } from '@/contexts/AuthContext';

type BuyerSectionLayoutProps = {
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

export function BuyerSectionLayout({ children }: BuyerSectionLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const currentPath = location.pathname;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [currentPath]);

  const buyerItems: SidebarItem[] = [
    {
      id: 'dashboard',
      label: 'My Dashboard',
      icon: LayoutDashboard,
      onClick: () => navigate('/buyer/dashboard'),
      active: currentPath === '/buyer/dashboard' || currentPath === '/dashboard',
    },
    {
      id: 'profile',
      label: 'My Profile',
      icon: UserRound,
      onClick: () => navigate('/buyer/profile'),
      active: currentPath === '/buyer/profile' || currentPath.startsWith('/profile/'),
    },
    {
      id: 'orders',
      label: 'My Orders',
      icon: ReceiptText,
      onClick: () => navigate('/buyer/orders'),
      active: currentPath.startsWith('/buyer/orders'),
    },
    {
      id: 'rentals',
      label: 'My Rentals',
      icon: Package,
      onClick: () => navigate('/buyer/rentals'),
      active: currentPath.startsWith('/buyer/rentals') || currentPath.startsWith('/buyer/rental-details'),
    },
    {
      id: 'payments',
      label: 'Payment History',
      icon: CreditCard,
      onClick: () => navigate('/buyer/payments'),
      active: currentPath.startsWith('/buyer/payments') || currentPath.startsWith('/buyer/receipt'),
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      onClick: () => navigate('/buyer/notifications'),
      active: currentPath.startsWith('/buyer/notifications'),
    },
    {
      id: 'recently-viewed',
      label: 'Recently Viewed',
      icon: Eye,
      onClick: () => navigate('/buyer/recently-viewed'),
      active: currentPath.startsWith('/buyer/recently-viewed'),
    },
    {
      id: 'disputes',
      label: 'Dispute Center',
      icon: ShieldAlert,
      onClick: () => navigate('/buyer/disputes'),
      active: currentPath.startsWith('/buyer/disputes'),
    },
    {
      id: 'report',
      label: 'Report Problem',
      icon: Flag,
      onClick: () => navigate('/buyer/report'),
      active: currentPath.startsWith('/buyer/report'),
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      onClick: () => navigate('/buyer/settings'),
      active: currentPath.startsWith('/buyer/settings'),
    },
    {
      id: 'help',
      label: 'Help & Support',
      icon: CircleHelp,
      onClick: () => navigate('/buyer/help'),
      active: currentPath.startsWith('/buyer/help'),
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
          <span className="text-sm font-semibold">Buyer Menu</span>
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
              <span className="text-sm font-semibold">Buyer Menu</span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1.5 p-3">{buyerItems.map(renderItem)}</div>
            <div className="border-t border-[#0b3f3f]" />
            <div className="space-y-1.5 p-3">{accountItems.map(renderItem)}</div>
          </nav>
        </div>

        <aside className="hidden lg:block lg:w-[248px] lg:shrink-0">
          <nav className="h-full bg-[#0F4C4C]">
            <div className="space-y-1.5 p-3">{buyerItems.map(renderItem)}</div>
            <div className="border-t border-[#0b3f3f]" />
            <div className="space-y-1.5 p-3">{accountItems.map(renderItem)}</div>
          </nav>
        </aside>

        <section className="min-w-0 flex-1">{children}</section>
      </div>
    </div>
  );
}
