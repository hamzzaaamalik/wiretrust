import { useState, useEffect } from 'react';
import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useWallet } from '../../contexts/WalletContext';
import {
  LayoutDashboard, Building2, Calendar, Users2, Trophy, Shield,
  Radio, UserCog, Droplets, ChevronLeft, Gavel, Wallet
} from 'lucide-react';

const ADMIN_LINKS = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/franchises', label: 'Franchises', icon: Building2 },
  { to: '/admin/matches', label: 'Matches', icon: Calendar },
  { to: '/admin/players', label: 'Players', icon: Users2 },
  { to: '/admin/challenges', label: 'Challenges', icon: Trophy },
  { to: '/admin/users', label: 'Users', icon: UserCog },
  { to: '/admin/oracle', label: 'Oracle', icon: Radio },
  { to: '/admin/settlement', label: 'Settlement', icon: Gavel },
];

export default function AdminLayout() {
  const { address, connected } = useWallet();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch('/api/admin/stats', {
      headers: { 'x-wallet-address': address }
    })
      .then(r => {
        setIsAdmin(r.ok);
      })
      .catch(() => setIsAdmin(false))
      .finally(() => setLoading(false));
  }, [address]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-zinc-500 text-sm">Verifying admin access...</div>
      </div>
    );
  }

  if (!connected || !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Shield size={40} className="text-zinc-600" />
        <h2 className="text-xl font-bold text-white">Admin Access Required</h2>
        <p className="text-zinc-500 text-sm">
          {!connected
            ? 'Connect the deployer wallet to access the admin portal.'
            : 'This wallet does not have admin privileges.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-6 min-h-[calc(100vh-8rem)]">
      {/* Sidebar */}
      <aside className="hidden lg:block w-56 shrink-0">
        <div className="sticky top-20 space-y-1">
          <NavLink to="/dashboard" className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 text-sm mb-4 transition-colors">
            <ChevronLeft size={14} /> Back to App
          </NavLink>
          <div className="flex items-center gap-2 mb-4 px-3">
            <div className="w-6 h-6 rounded-md bg-red-500/20 flex items-center justify-center">
              <Shield size={12} className="text-red-400" />
            </div>
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Super Admin</span>
          </div>
          {ADMIN_LINKS.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'text-white bg-zinc-800/80 border border-zinc-700/50'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
                }`
              }
            >
              <link.icon size={15} strokeWidth={1.75} />
              {link.label}
            </NavLink>
          ))}
        </div>
      </aside>

      {/* Mobile nav */}
      <div className="lg:hidden fixed bottom-16 left-0 right-0 z-40 bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800/50 px-2 py-1.5">
        <div className="flex items-center justify-around overflow-x-auto gap-1">
          {ADMIN_LINKS.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-2xs font-medium transition-all shrink-0 ${
                  isActive ? 'text-red-400' : 'text-zinc-600'
                }`
              }
            >
              <link.icon size={16} strokeWidth={1.5} />
              <span className="truncate">{link.label}</span>
            </NavLink>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
