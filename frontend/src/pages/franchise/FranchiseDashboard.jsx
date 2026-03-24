import { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { useWallet } from '../../contexts/WalletContext';
import {
  Calendar, Users2, Trophy, Target, Image, Wallet, Radio,
  TrendingUp, Building2
} from 'lucide-react';

function StatCard({ label, value, icon: Icon, color = 'text-primary-light', sub }) {
  return (
    <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5 hover:border-zinc-700/60 transition-all">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xs text-zinc-500 uppercase tracking-wider font-medium">{label}</span>
        <Icon size={14} className={`${color} opacity-50`} />
      </div>
      <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
      {sub && <div className="text-2xs text-zinc-600 mt-1">{sub}</div>}
    </div>
  );
}

export default function FranchiseDashboard() {
  const { address } = useWallet();
  const { franchise } = useOutletContext();
  const [stats, setStats] = useState(null);
  const [fanStats, setFanStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const h = { 'x-wallet-address': address || '' };
    Promise.all([
      fetch('/api/franchise-portal/stats', { headers: h }).then(r => r.json()),
      fetch('/api/franchise-portal/fan-stats', { headers: h }).then(r => r.json()),
    ])
      .then(([s, f]) => { setStats(s); setFanStats(f); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [address]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-zinc-800 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-28 bg-zinc-900/70 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Franchise header */}
      <div className="bg-gradient-to-r from-violet-500/10 via-blue-500/5 to-transparent border border-violet-500/20 rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/30 to-blue-500/20 flex items-center justify-center">
            <Building2 size={24} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{franchise?.name}</h1>
            <div className="flex items-center gap-3 text-sm text-zinc-400 mt-1">
              <span>{franchise?.league}</span>
              <span className="text-zinc-600">·</span>
              <span>Franchise #{franchise?.franchiseId}</span>
              <span className="text-zinc-600">·</span>
              <span className="text-emerald-400">{franchise?.treasuryBalance} WIRE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div>
        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Franchise Data</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Matches" value={stats?.matchCount || 0} icon={Calendar} color="text-blue-400" />
          <StatCard label="Players" value={stats?.playerCount || 0} icon={Users2} color="text-emerald-400" />
          <StatCard label="Challenges" value={stats?.challengeCount || 0} icon={Trophy} color="text-amber-400" />
          <StatCard label="Treasury" value={`${parseFloat(franchise?.treasuryBalance || 0).toFixed(2)}`} icon={Wallet} color="text-accent" sub="WIRE" />
        </div>
      </div>

      <div>
        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Fan Engagement</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatCard label="Predictions" value={fanStats?.predictions || 0} icon={Target} color="text-violet-400" />
          <StatCard label="Squad Challenges" value={fanStats?.contests || 0} icon={TrendingUp} color="text-pink-400" />
          <StatCard label="NFTs Minted" value={fanStats?.nfts || 0} icon={Image} color="text-cyan-400" />
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { to: '/franchise/matches', label: 'Manage Schedule', desc: 'Create and update match fixtures', icon: Calendar, color: 'from-blue-500/20 to-blue-600/5 border-blue-500/20' },
            { to: '/franchise/players', label: 'Player Roster', desc: 'Add and manage team players', icon: Users2, color: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/20' },
            { to: '/franchise/live', label: 'Go Live', desc: 'Update live match scores and state', icon: Radio, color: 'from-amber-500/20 to-amber-600/5 border-amber-500/20' },
          ].map(({ to, label, desc, icon: Icon, color }) => (
            <Link key={to} to={to} className={`bg-gradient-to-br ${color} border rounded-2xl p-5 hover:scale-[1.02] transition-all`}>
              <Icon size={20} className="text-white/70 mb-2" />
              <div className="text-sm font-semibold text-white">{label}</div>
              <div className="text-2xs text-zinc-400 mt-1">{desc}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Wallet info */}
      <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-zinc-500">Admin Wallet: </span>
            <span className="text-zinc-400 font-mono">{franchise?.adminWallet?.slice(0, 6)}...{franchise?.adminWallet?.slice(-4)}</span>
          </div>
          <div>
            <span className="text-zinc-500">Treasury: </span>
            <span className="text-zinc-400 font-mono">{franchise?.treasuryWallet?.slice(0, 6)}...{franchise?.treasuryWallet?.slice(-4)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
