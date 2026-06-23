import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  ShoppingCart,
  History,
  ScanLine,
  BarChart3,
  Settings2,
  Users,
  Banknote,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { BRAND_NAME } from '@/lib/brand';
import { TicketsPermission, hasPermission, canManageEvents } from '@/lib/permissions';

interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  show: boolean;
}

export function Sidebar() {
  const { user } = useAuth();

  // Sales-only accounts (e.g. a reseller like PicknPay) lack event-management
  // and scanning permissions, so the Events and Entry Scan tabs are hidden —
  // their job is only to sell tickets. Full vendor accounts keep every tab.
  const navigation: NavigationItem[] = [
    {
      name: 'Dashboard',
      href: '/',
      icon: LayoutDashboard,
      show: true,
    },
    {
      name: 'Events',
      href: '/events',
      icon: Calendar,
      show: canManageEvents(user),
    },
    {
      name: 'Sell Tickets',
      href: '/sell-tickets',
      icon: ShoppingCart,
      show: hasPermission(user, TicketsPermission.SELL_TICKETS),
    },
    {
      name: 'Sales History',
      href: '/sales-history',
      icon: History,
      show: hasPermission(user, TicketsPermission.VIEW_SALES),
    },
    {
      name: 'Entry Scan',
      href: '/entry-scan',
      icon: ScanLine,
      show: hasPermission(user, TicketsPermission.SCAN_TICKETS),
    },
    {
      name: 'Analytics',
      href: '/analytics',
      icon: BarChart3,
      show: hasPermission(user, TicketsPermission.VIEW_STATS),
    },
    ...(user?.isSuperAdmin ? [
      { name: 'Settings', href: '/settings', icon: Settings2, show: true },
      { name: 'Resellers', href: '/resellers', icon: Users, show: true },
      { name: 'Payouts', href: '/payouts', icon: Banknote, show: true },
    ] : []),
  ].filter((item) => item.show);

  return (
    <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-slate-200">
        <NavLink to="/" className="flex items-center space-x-3 group">
          <img src="/carrot_tickets_icon.png" alt={BRAND_NAME} className="h-12 w-12" />
          <div className="space-y-0">
            <h2 className="text-lg font-bold text-slate-900">{BRAND_NAME}</h2>
            <p className="text-xs text-slate-500">
              {user?.businessName || 'Event Management'}
            </p>
          </div>
        </NavLink>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            end={item.href === '/'}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 border border-orange-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`
            }
          >
            <item.icon className="h-5 w-5" />
            <span>{item.name}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-200">
        <div className="text-xs text-slate-500 space-y-1">
          <p>© 2026 {BRAND_NAME}</p>
          <p>Version 1.0.0</p>
          {user && (
            <p className="text-orange-600 font-medium mt-2">
              {user.role === 'admin' ? '👑 Admin' : '🎫 Vendor'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
