import React from 'react';
import { Home, ShoppingCart, Wallet, HeadphonesIcon, User } from 'lucide-react';
import { DASHBOARD_NAV_ITEMS, type DashboardTab } from '../../config/navigation.config';
import { useApp } from '../../context/AppContext';

const BOTTOM_ICONS: Record<'home' | 'order' | 'funds' | 'support' | 'profile', React.ReactNode> = {
  home: <Home className="h-5 w-5" />,
  order: <ShoppingCart className="h-5 w-5" />,
  funds: <Wallet className="h-5 w-5" />,
  support: <HeadphonesIcon className="h-5 w-5" />,
  profile: <User className="h-5 w-5" />,
};

export function MobileBottomNav() {
  const { activeTab, navigateProtected } = useApp();
  const bottomItems = DASHBOARD_NAV_ITEMS.filter((item) => item.showInBottomNav);

  return (
    <nav
      aria-label="Mobile bottom navigation"
      className="fixed bottom-0 left-0 right-0 z-30 h-14 border-t border-violet-100 bg-white/95 backdrop-blur-md lg:hidden"
    >
      <div className="mx-auto grid h-full max-w-lg grid-cols-5 items-center px-1">
        {bottomItems.map((item) => {
          const isActive = activeTab === item.id;
          const iconKey = item.id as keyof typeof BOTTOM_ICONS;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                navigateProtected(item.id as DashboardTab);
                if (typeof window !== 'undefined') {
                  try {
                    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
                  } catch {
                    window.scrollTo(0, 0);
                  }
                  document.documentElement.scrollTop = 0;
                  document.body.scrollTop = 0;
                }
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex h-full flex-col items-center justify-center gap-0.5 transition-colors ${
                isActive ? 'text-violet-700' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 h-0.5 w-8 rounded-full bg-violet-700"
                />
              )}
              {BOTTOM_ICONS[iconKey]}
              <span className={`text-[11px] leading-none ${isActive ? 'font-bold' : 'font-medium'}`}>
                {item.shortLabel}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
