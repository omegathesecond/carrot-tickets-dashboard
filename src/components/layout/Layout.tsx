import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { VerificationBanner } from '@/components/VerificationBanner';

export function Layout() {
  return (
    <div className="w-full h-screen flex overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <VerificationBanner />
        <main className="flex-1 overflow-auto bg-gradient-to-br from-amber-50 to-orange-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
