import { ComponentType, ReactNode } from 'react';
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
            <div className="space-y-1.5 p-3">{buyerItems.map(renderItem)}</div>
            <div className="border-t border-[#0e5a51]" />
            <div className="space-y-1.5 p-3">{accountItems.map(renderItem)}</div>
          </nav>
        </aside>

        <section className="min-w-0 flex-1">{children}</section>
      </div>
    </div>
  );
}
