import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { apiClient } from '@/lib/api';
import {
  LayoutDashboard,
  Calendar,
  ShoppingCart,
  History,
  ScanLine,
  BarChart3,
  Settings2,
  Users,
  UsersRound,
  Banknote,
  ShieldCheck,
  Building2,
  Ticket,
  Flag,
  Video,
  Sparkles,
  ExternalLink,
  X,
  Bus,
  Route,
  Truck,
  Armchair,
  Receipt,
  Store,
  Boxes,
  type LucideIcon,
} from 'lucide-react';

// The organizer's brand social feed lives on the consumer site (same login).
// This is the single door from the dashboard so organizers don't need a 2nd URL.
const SOCIAL_LOGIN_URL = 'https://carrottickets.com/brand/login';
const SOCIAL_SSO_URL = 'https://carrottickets.com/brand/sso';
import { useAuth } from '@/contexts/AuthContext';
import { BRAND_NAME } from '@/lib/brand';
import { getOperatorContext, operatorLabel, operatorHomePath } from '@/lib/operatorContext';
import {
  TicketsPermission,
  hasPermission,
  canManageEvents,
  canManageAccess,
  canViewUsers,
  canPrintWristbands,
  canModerateSocial,
  canManageTransport,
  canManageStock,
} from '@/lib/permissions';

interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
  show: boolean;
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user } = useAuth();
  const [openingSocial, setOpeningSocial] = useState(false);
  const ctx = getOperatorContext(user);
  const homePath = operatorHomePath(ctx);

  // Mint a one-time SSO handoff so the organizer lands in the social feed
  // already signed in (no second login). Falls back to the social login page.
  async function openSocialFeed() {
    onClose();
    setOpeningSocial(true);
    try {
      const { handoff } = await apiClient.auth.socialHandoff();
      window.open(`${SOCIAL_SSO_URL}#h=${encodeURIComponent(handoff)}`, '_blank', 'noopener');
    } catch {
      window.open(SOCIAL_LOGIN_URL, '_blank', 'noopener');
    } finally {
      setOpeningSocial(false);
    }
  }

  // Sales-only accounts (e.g. a reseller like PicknPay) lack event-management
  // and scanning permissions, so the Events and Entry Scan tabs are hidden —
  // their job is only to sell tickets. Full vendor accounts keep every tab.
  const navigation: NavigationItem[] = [
    {
      name: 'Dashboard',
      href: homePath,
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
      name: 'Updates',
      href: '/updates',
      icon: Video,
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
      name: 'Gate Operators',
      href: '/gate-operators',
      icon: ShieldCheck,
      show: canManageAccess(user),
    },
    {
      name: 'Cashiers',
      href: '/cashiers',
      icon: Banknote,
      show: canManageAccess(user),
    },
    {
      name: 'Vendors',
      href: '/vendors',
      icon: Store,
      show: canManageAccess(user),
    },
    {
      name: 'Catalogue',
      href: '/stock',
      icon: Boxes,
      show: canManageStock(user),
    },
    {
      name: 'Analytics',
      href: '/analytics',
      icon: BarChart3,
      show: hasPermission(user, TicketsPermission.VIEW_STATS),
    },
    {
      name: 'Users',
      href: '/users',
      icon: UsersRound,
      show: canViewUsers(user),
    },
    {
      name: 'Wristbands',
      href: '/wristbands',
      icon: Ticket,
      show: canPrintWristbands(user),
    },
    {
      name: 'Reports',
      href: '/reports',
      icon: Flag,
      show: canModerateSocial(user),
    },
    {
      name: 'Bus Trips',
      href: '/transport/trips',
      icon: Bus,
      show: canManageTransport(user),
    },
    {
      name: 'Bus Routes',
      href: '/transport/routes',
      icon: Route,
      show: canManageTransport(user),
    },
    {
      name: 'Vehicles',
      href: '/transport/vehicle-types',
      icon: Truck,
      show: canManageTransport(user),
    },
    {
      name: 'Bus Bookings',
      href: '/transport/bookings',
      icon: Armchair,
      show: canManageTransport(user),
    },
    ...(user?.isSuperAdmin ? [
      { name: 'Organizers', href: '/organizers', icon: Building2, show: true },
      { name: 'Settings', href: '/settings', icon: Settings2, show: true },
      { name: 'Resellers', href: '/resellers', icon: Users, show: true },
      { name: 'Payouts', href: '/payouts', icon: Banknote, show: true },
      { name: 'Fees', href: '/fees', icon: Receipt, show: true },
    ] : []),
  ].filter((item) => item.show);

  return (
    <>
      {/* Mobile backdrop — tap to dismiss. Hidden from md up. */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 md:hidden transition-opacity ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Static column on desktop; off-canvas drawer on mobile. */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col
          transform transition-transform duration-200 md:static md:z-auto md:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Logo + mobile close */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <NavLink to={homePath} onClick={onClose} className="flex items-center space-x-3 group min-w-0">
            <img src="/carrot_tickets_icon.png" alt={BRAND_NAME} className="h-12 w-12 shrink-0" />
            <div className="space-y-0 min-w-0">
              <h2 className="text-lg font-bold text-slate-900">{BRAND_NAME}</h2>
              <p className="text-xs text-slate-500 truncate">
                {user?.businessName || operatorLabel(ctx)}
              </p>
            </div>
          </NavLink>
          <button
            onClick={onClose}
            className="md:hidden p-1 -mr-1 text-slate-500 hover:text-slate-900"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation — tapping a link closes the drawer on mobile. */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {/* Brand social feed — the consumer-app social experience for this
              brand (post/like/follow/DM). Opens the same-login social site. */}
          {canManageEvents(user) && (
            <button
              type="button"
              onClick={openSocialFeed}
              disabled={openingSocial}
              className="w-full flex items-center justify-between px-3 py-2.5 mb-1 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-orange-500 to-amber-500 shadow-sm hover:from-orange-600 hover:to-amber-600 transition-colors disabled:opacity-70"
            >
              <span className="flex items-center space-x-3">
                <Sparkles className="h-5 w-5" />
                <span>{openingSocial ? 'Opening…' : 'Brand social feed'}</span>
              </span>
              <ExternalLink className="h-4 w-4 opacity-80" />
            </button>
          )}
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              end={item.href === '/'}
              onClick={onClose}
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
            <p className="text-orange-600 font-medium mt-2">{operatorLabel(ctx)}</p>
          </div>
        </div>
      </div>
    </>
  );
}
