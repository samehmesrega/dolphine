import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — hidden on mobile, shown via overlay */}
      <div
        className={`fixed inset-y-0 right-0 z-50 md:static md:z-auto transition-transform duration-200 md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <Sidebar onNavigate={() => setMobileOpen(false)} />
      </div>

      {/* Main content */}
      <main className="flex-1 p-3 sm:p-6 overflow-y-auto">
        {/* Mobile hamburger button */}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="md:hidden fixed top-3 right-3 z-30 bg-slate-900 text-white p-2.5 rounded-xl shadow-lg"
          aria-label="القائمة"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Outlet />
      </main>
    </div>
  );
}
