export type DashboardTab =
  | 'home'
  | 'order'
  | 'funds'
  | 'support'
  | 'profile'
  | 'services'
  | 'notifications'
  | 'api';

export type PublicRoute = 'landing';

export interface NavDestination {
  id: DashboardTab;
  label: string;
  shortLabel: string;
  showInBottomNav: boolean;
}

export const DASHBOARD_NAV_ITEMS: NavDestination[] = [
  { id: 'home', label: 'Dashboard', shortLabel: 'Home', showInBottomNav: true },
  { id: 'order', label: 'Orders', shortLabel: 'Order', showInBottomNav: true },
  { id: 'funds', label: 'Add Funds', shortLabel: 'Funds', showInBottomNav: true },
  { id: 'support', label: 'Support', shortLabel: 'Support', showInBottomNav: true },
  { id: 'profile', label: 'Profile', shortLabel: 'Profile', showInBottomNav: true },
  { id: 'services', label: 'All Services', shortLabel: 'Services', showInBottomNav: false },
  { id: 'api', label: 'API Gateway', shortLabel: 'API', showInBottomNav: false },
  {
    id: 'notifications',
    label: 'Notifications',
    shortLabel: 'Alerts',
    showInBottomNav: false,
  },
];

export const PUBLIC_NAV_LINKS = [
  { href: '#services', label: 'Services' },
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#why-us', label: 'Why Us' },
];
