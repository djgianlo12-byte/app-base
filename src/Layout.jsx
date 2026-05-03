import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { LayoutDashboard, ClipboardList, CalendarDays, Map, Plus, LogOut, PenLine, Mail, Wrench } from 'lucide-react';

const navItemsBase = [
  { page: 'Dashboard', icon: LayoutDashboard, label: 'Home' },
  { page: 'Werkbonnen', icon: ClipboardList, label: 'Bonnen' },
  { page: 'Agenda', icon: CalendarDays, label: 'Agenda' },
];

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  const isKantoor = user?.role === 'admin' || user?.role === 'kantoor';
  const isVerkoper = user?.role === 'admin' || user?.role === 'kantoor' || user?.role === 'verkoper';
  const isBuitendienst = user?.role === 'buitendienst';
  const navItems = [
    ...navItemsBase,
    ...(isBuitendienst ? [{ page: 'KaartView', icon: Map, label: 'Kaart' }] : []),
    ...(isVerkoper ? [{ page: 'MontageOverzicht', icon: Wrench, label: 'Montage' }] : []),
    { page: 'TekeningOpdrachten', icon: PenLine, label: 'Tekeningen' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <ClipboardList className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-slate-900 text-sm">Werkbon Tracker</span>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <span className="text-xs text-slate-500 hidden sm:block">
              {user.full_name}
            </span>
          )}
          <a href="https://outlook.office.com" target="_blank" rel="noopener noreferrer"
            className="p-2 text-slate-400 hover:text-blue-600 rounded-lg transition-colors" title="Outlook openen">
            <Mail className="w-4 h-4" />
          </a>
          <button onClick={() => base44.auth.logout()} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="px-4 py-4 max-w-lg mx-auto pb-28">
        {children}
      </main>

      {/* Bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 z-50" style={{paddingBottom: 'max(env(safe-area-inset-bottom), 8px)'}}>
        <div className="max-w-lg mx-auto flex items-center justify-around">
          {navItems.map(({ page, icon: Icon, label }) => {
            const isActive = currentPageName === page;
            return (
              <Link
                key={page}
                to={createPageUrl(page)}
                className={`flex flex-col items-center py-2 px-3 text-xs transition-colors min-w-[48px] ${
                  isActive ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                <span className={isActive ? 'font-semibold' : 'font-medium'}>{label}</span>
              </Link>
            );
          })}
          {(user?.role === 'admin' || user?.role === 'kantoor') && (
            <Link
              to={createPageUrl('WerkbonAanmaken')}
              className="flex flex-col items-center py-2 px-3"
            >
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center -mt-5 shadow-lg shadow-blue-200">
                <Plus className="w-5 h-5 text-white" />
              </div>
              <span className="text-xs text-blue-600 font-semibold mt-0.5">Nieuw</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}