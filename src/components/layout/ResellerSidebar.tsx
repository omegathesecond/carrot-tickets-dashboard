import { NavLink, useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  History,
  BarChart3,
  Building2,
  Users,
  Banknote,
  LogOut,
} from 'lucide-react';
import { useResellerAuth } from '@/contexts/ResellerAuthContext';
import { hasResellerPermission, ResellerPermission } from '@/lib/resellerPermissions';

const ROLE_LABELS: Record<string, string> = {
  reseller_admin: 'Admin',
  reseller_hub_manager: 'Hub Manager',
  reseller_operator: 'Operator',
};

interface NavItem {
  to: string;
  label: string;
  icon: typeof ShoppingCart;
  end?: boolean;
  show: boolean;
}

export function ResellerSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { operator, logout } = useResellerAuth();
  const navigate = useNavigate();

  const items: NavItem[] = [
    { to: '/reseller', label: 'Sell Tickets', icon: ShoppingCart, end: true, show: hasResellerPermission(operator, ResellerPermission.SELL_TICKETS) },
    { to: '/reseller/sales-history', label: 'Sales History', icon: History, show: hasResellerPermission(operator, ResellerPermission.VIEW_HUB_SALES) },
    { to: '/reseller/reports', label: 'Reports', icon: BarChart3, show: hasResellerPermission(operator, ResellerPermission.VIEW_REPORTS) },
    { to: '/reseller/hubs', label: 'Hubs', icon: Building2, show: hasResellerPermission(operator, ResellerPermission.VIEW_HUB_SALES) },
    { to: '/reseller/operators', label: 'Operators', icon: Users, show: hasResellerPermission(operator, ResellerPermission.MANAGE_OPERATORS) },
    { to: '/reseller/payouts', label: 'Payouts', icon: Banknote, show: hasResellerPermission(operator, ResellerPermission.REQUEST_PAYOUT) },
  ];

  const handleLogout = () => {
    logout();
    onNavigate?.();
    navigate('/reseller/login');
  };

  return (
    <div className="flex h-full w-64 flex-col bg-white">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-slate-100">
        <img src="/carrot_tickets_icon.png" alt="Carrot Tickets" className="h-9 w-9" />
        <div className="min-w-0">
          <p className="font-bold text-slate-900 leading-tight">Carrot Tickets</p>
          <p className="text-xs text-slate-500 leading-tight">Reseller Portal</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {items
          .filter((i) => i.show)
          .map((i) => {
            const Icon = i.icon;
            return (
              <NavLink
                key={i.to}
                to={i.to}
                end={i.end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-gradient-to-r from-orange-50 to-amber-50 text-orange-700 border border-orange-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`
                }
              >
                <Icon className="h-4.5 w-4.5 shrink-0" style={{ width: 18, height: 18 }} />
                <span className="truncate">{i.label}</span>
              </NavLink>
            );
          })}
      </nav>

      {/* Operator + logout */}
      <div className="border-t border-slate-100 p-3">
        {operator && (
          <div className="px-2 pb-2">
            <p className="text-sm font-semibold text-slate-900 truncate">{operator.fullName}</p>
            <p className="text-xs text-slate-500">{ROLE_LABELS[operator.role] ?? operator.role}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
          Logout
        </button>
      </div>
    </div>
  );
}
