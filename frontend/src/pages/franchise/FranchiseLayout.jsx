import { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useWallet } from '../../contexts/WalletContext';
import {
  LayoutDashboard, Calendar, Users2, Trophy, Radio, ChevronLeft, Building2, Swords, BarChart3
} from 'lucide-react';

const LINKS = [
  { to: '/franchise', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/franchise/matches', label: 'Matches', icon: Calendar },
  { to: '/franchise/players', label: 'Players', icon: Users2 },
  { to: '/franchise/challenges', label: 'Challenges', icon: Trophy },
  { to: '/franchise/live', label: 'Live Control', icon: Radio },
  { to: '/franchise/contests', label: 'Contests', icon: Swords },
  { to: '/franchise/analytics', label: 'Analytics', icon: BarChart3 },
];

export default function FranchiseLayout() {
  const { address, connected } = useWallet();
  const [franchise, setFranchise] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!address) { setLoading(false); setError('Connect your wallet'); return; }
    setLoading(true);
    fetch('/api/franchise-portal/info', { headers: { 'x-wallet-address': address } })
      .then(r => {
        if (!r.ok) throw new Error(r.status === 403 ? 'not_admin' : 'error');
        return r.json();
      })
      .then(data => { setFranchise(data); setError(null); })
      .catch(err => { setFranchise(null); setError(err.message === 'not_admin' ? 'not_admin' : 'error'); })
      .finally(() => setLoading(false));
  }, [address]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-zinc-500 text-sm">Verifying franchise access...</div>
      </div>
    );
  }

  if (!connected || error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Building2 size={40} className="text-zinc-600" />
        <h2 className="text-xl font-bold text-white">Franchise Portal</h2>
        <p className="text-zinc-500 text-sm text-center max-w-md">
          {!connected
            ? 'Connect your franchise admin wallet to access the management portal.'
            : error === 'not_admin'
            ? 'This wallet is not registered as a franchise admin. Contact the super admin to get onboarded.'
            : 'Failed to verify franchise access. Please try again.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-6 min-h-[calc(100vh-8rem)]">
      {/* Sidebar */}
      <aside className="hidden lg:block w-56 shrink-0">
        <div className="sticky top-20 space-y-1">
          <NavLink to="/" className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 text-sm mb-4 transition-colors">
            <ChevronLeft size={14} /> Back to App
          </NavLink>
          <div className="flex items-center gap-2 mb-4 px-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/30 to-blue-500/20 flex items-center justify-center">
              <Building2 size={14} className="text-violet-400" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">{franchise?.name}</div>
              <div className="text-2xs text-zinc-500">{franchise?.league} · #{franchise?.franchiseId}</div>
            </div>
          </div>
          {LINKS.map(link => (
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
          {LINKS.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-2xs font-medium transition-all shrink-0 ${
                  isActive ? 'text-violet-400' : 'text-zinc-600'
                }`
              }
            >
              <link.icon size={16} strokeWidth={1.5} />
              <span className="truncate">{link.label}</span>
            </NavLink>
          ))}
        </div>
      </div>

      {/* Content - pass franchise context */}
      <div className="flex-1 min-w-0">
        <Outlet context={{ franchise }} />
      </div>
    </div>
  );
}
