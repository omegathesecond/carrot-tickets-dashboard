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
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { BRAND_NAME } from '@/lib/brand';

interface NavigationItem {
  name: string;
  href: string;
  icon: any;
}

export function Sidebar() {
  const { user } = useAuth();

  const navigation: NavigationItem[] = [
    {
      name: 'Dashboard',
      href: '/',
      icon: LayoutDashboard,
    },
    {
      name: 'Events',
      href: '/events',
      icon: Calendar,
    },
    {
      name: 'Sell Tickets',
      href: '/sell-tickets',
      icon: ShoppingCart,
    },
    {
      name: 'Sales History',
      href: '/sales-history',
      icon: History,
    },
    {
      name: 'Entry Scan',
      href: '/entry-scan',
      icon: ScanLine,
    },
    {
      name: 'Analytics',
      href: '/analytics',
      icon: BarChart3,
    },
    ...(user?.isSuperAdmin ? [
      { name: 'Settings', href: '/settings', icon: Settings2 },
      { name: 'Resellers', href: '/resellers', icon: Users },
    ] : []),
  ];

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
