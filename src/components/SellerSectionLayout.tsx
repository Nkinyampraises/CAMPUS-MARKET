import { ComponentType, ReactNode } from 'react';
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
import { cn } from '@/app/components/ui/utils';
import { useAuth } from '@/contexts/AuthContext';

type SellerSectionLayoutProps = {
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

export function SellerSectionLayout({ children }: SellerSectionLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const currentPath = location.pathname;

  const sellerItems: SidebarItem[] = [
    {
      id: 'dashboard',
      label: 'My Dashboard',
      icon: LayoutDashboard,
      onClick: () => navigate('/seller/dashboard'),
      active: currentPath === '/seller/dashboard' || currentPath === '/dashboard',
    },
    {
      id: 'profile',
      label: 'My Profile',
      icon: UserRound,
      onClick: () => navigate('/seller/profile'),
      active: currentPath.startsWith('/seller/profile') || currentPath.startsWith('/profile/'),
    },
    {
      id: 'manage-listings',
      label: 'Manage Listings',
      icon: Package,
      onClick: () => navigate('/seller/manage-listings'),
      active: currentPath.startsWith('/seller/manage-listings') || currentPath.startsWith('/seller/edit-listing'),
    },
    {
      id: 'orders',
      label: 'Orders',
      icon: ReceiptText,
      onClick: () => navigate('/seller/orders'),
      active: currentPath.startsWith('/seller/orders') || currentPath.startsWith('/seller/order-details'),
    },
    {
      id: 'rentals',
      label: 'Rentals',
      icon: Package,
      onClick: () => navigate('/seller/rentals'),
      active: currentPath.startsWith('/seller/rentals'),
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      onClick: () => navigate('/seller/notifications'),
      active: currentPath.startsWith('/seller/notifications'),
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      onClick: () => navigate('/seller/settings'),
      active: currentPath.startsWith('/seller/settings'),
    },
    {
      id: 'help',
      label: 'Help & Support',
      icon: CircleHelp,
      onClick: () => navigate('/seller/help'),
      active: currentPath.startsWith('/seller/help'),
    },
    {
      id: 'report',
      label: 'Report Problem',
      icon: Flag,
      onClick: () => navigate('/seller/reports'),
      active: currentPath.startsWith('/seller/reports'),
    },
    {
      id: 'disputes',
      label: 'Disputes',
      icon: ShieldAlert,
      onClick: () => navigate('/seller/disputes'),
      active: currentPath.startsWith('/seller/disputes'),
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
            <div className="space-y-1.5 p-3">{sellerItems.map(renderItem)}</div>
            <div className="border-t border-[#0e5a51]" />
            <div className="space-y-1.5 p-3">{accountItems.map(renderItem)}</div>
          </nav>
        </aside>

        <section className="min-w-0 flex-1">{children}</section>
      </div>
    </div>
  );
}
