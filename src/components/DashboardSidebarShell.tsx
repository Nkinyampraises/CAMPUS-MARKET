import { ComponentType, ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import { useHeaderHeight } from '@/hooks/useHeaderHeight';

export type DashboardNavItem = {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
  active: boolean;
  tone?: 'default' | 'danger';
};

type DashboardSidebarShellProps = {
  menuLabel: string;
  items: DashboardNavItem[];
  accountItems: DashboardNavItem[];
  navHeader?: ReactNode;
  children: ReactNode;
};

// Reusable dashboard chrome: mobile top-bar + slide-in drawer + a desktop
// sidebar that stays fixed while the main content scrolls independently.
export function DashboardSidebarShell({
  menuLabel,
  items,
  accountItems,
  navHeader,
  children,
}: DashboardSidebarShellProps) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const headerHeight = useHeaderHeight();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const renderItem = (item: DashboardNavItem) => (
    <button
      key={item.id}
      type="button"
      onClick={item.onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-left text-[0.97rem] font-medium transition-colors duration-200',
        item.active
          ? 'bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-sm'
          : item.tone === 'danger'
            ? 'text-red-300 hover:bg-red-500/15 hover:text-red-200'
            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
      )}
    >
      <item.icon
        className={cn(
          'h-[18px] w-[18px] shrink-0',
          item.active
            ? 'text-sidebar-primary-foreground'
            : item.tone === 'danger'
              ? 'text-red-300'
              : 'text-sidebar-foreground/70',
        )}
      />
      <span>{item.label}</span>
    </button>
  );

  const navBody = (
    <>
      {navHeader}
      <div className="space-y-1.5 p-3">{items.map(renderItem)}</div>
      <div className="mx-3 border-t border-sidebar-border" />
      <div className="space-y-1.5 p-3">{accountItems.map(renderItem)}</div>
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-screen w-full flex-col lg:flex-row">
        {/* Mobile top bar */}
        <div className="flex items-center justify-between bg-sidebar px-4 py-3 text-sidebar-foreground lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-sidebar-foreground hover:bg-white/25"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold">{menuLabel}</span>
          <div className="h-9 w-9" />
        </div>

        {/* Mobile drawer */}
        <div className={cn('fixed inset-0 z-40 lg:hidden', sidebarOpen ? 'visible' : 'invisible')}>
          <button
            type="button"
            aria-label="Close menu overlay"
            onClick={() => setSidebarOpen(false)}
            className={cn('absolute inset-0 bg-black/40 transition-opacity', sidebarOpen ? 'opacity-100' : 'opacity-0')}
          />
          <nav
            className={cn(
              'absolute left-0 top-0 h-full w-[260px] overflow-y-auto bg-sidebar text-sidebar-foreground shadow-modal transition-transform',
              sidebarOpen ? 'translate-x-0' : '-translate-x-full',
            )}
          >
            <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-4">
              <span className="text-sm font-semibold">{menuLabel}</span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-sidebar-foreground hover:bg-white/25"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {navBody}
          </nav>
        </div>

        {/* Desktop sticky sidebar — stays fixed while main scrolls */}
        <aside
          className="hidden lg:block lg:w-[248px] lg:shrink-0 lg:self-start lg:sticky"
          style={{ top: headerHeight, height: `calc(100vh - ${headerHeight}px)` }}
        >
          <nav className="h-full overflow-y-auto border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
            {navBody}
          </nav>
        </aside>

        <section className="min-w-0 flex-1">{children}</section>
      </div>
    </div>
  );
}
