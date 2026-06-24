import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { VerificationBanner } from '@/components/VerificationBanner';

export function Layout() {
  // The sidebar is a static column on desktop and a slide-in drawer on mobile;
  // this state only drives the mobile drawer.
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="w-full h-screen flex overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <VerificationBanner />
        <main className="flex-1 overflow-auto bg-gradient-to-br from-amber-50 to-orange-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
