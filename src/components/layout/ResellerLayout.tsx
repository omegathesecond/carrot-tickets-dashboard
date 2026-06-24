import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { ResellerSidebar } from './ResellerSidebar';

/** Shell for the reseller manager/admin portal: fixed sidebar on desktop,
 *  slide-over drawer on mobile, page content in the Outlet. */
export function ResellerLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:block w-64 shrink-0 border-r border-slate-200">
        <ResellerSidebar />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-64 shadow-xl">
            <ResellerSidebar onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-30 flex items-center gap-2 border-b border-orange-100 bg-white/95 px-3 py-2 backdrop-blur">
          <button
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg p-2 text-slate-700 hover:bg-slate-100"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <img src="/carrot_tickets_icon.png" alt="" className="h-6 w-6" />
          <span className="font-semibold text-slate-900">Carrot Tickets</span>
        </header>

        <main className="min-w-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
