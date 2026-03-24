import { useState, useEffect } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { Link } from 'react-router-dom';
import {
  Users2, Bot, Target, Image, Trophy, Building2, Droplets, Blocks,
  Wallet, TrendingUp, Calendar
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

export default function AdminDashboard() {
  const { address } = useWallet();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stats', { headers: { 'x-wallet-address': address || '' } })
      .then(r => r.json())
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [address]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-zinc-800 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="h-28 bg-zinc-900/70 rounded-2xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  const on = stats?.onChain || {};
  const off = stats?.offChain || {};

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Super Admin</h1>
        <p className="text-sm text-zinc-500 mt-1">WireTrust Protocol Management</p>
      </div>

      {/* On-chain stats */}
      <div>
        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">On-Chain</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Franchises" value={on.totalFranchises || 0} icon={Building2} color="text-violet-400" />
          <StatCard label="Agents" value={on.totalAgents || 0} icon={Bot} color="text-blue-400" />
          <StatCard label="Predictions" value={on.totalPredictions || 0} icon={Target} color="text-emerald-400" />
          <StatCard label="NFTs Minted" value={on.totalNFTs || 0} icon={Image} color="text-amber-400" />
          <StatCard label="Contests" value={on.totalContests || 0} icon={Trophy} color="text-pink-400" />
          <StatCard label="Block Height" value={on.blockNumber?.toLocaleString() || 0} icon={Blocks} color="text-zinc-400" />
          <StatCard label="Treasury" value={`${parseFloat(on.treasuryBalance || 0).toFixed(2)} WIRE`} icon={Wallet} color="text-accent" />
        </div>
      </div>

      {/* Off-chain stats */}
      <div>
        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Off-Chain (Database)</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Registered Users" value={off.totalUsers || 0} icon={Users2} color="text-indigo-400" />
          <StatCard label="Faucet Drips" value={off.totalFaucetDrips || 0} icon={Droplets} color="text-cyan-400" />
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { to: '/admin/franchises', label: 'Onboard Franchise', desc: 'Register a new sports franchise on-chain', icon: Building2, color: 'from-violet-500/20 to-violet-600/5 border-violet-500/20' },
            { to: '/admin/matches', label: 'Manage Matches', desc: 'Create/update PSL match schedule', icon: Calendar, color: 'from-blue-500/20 to-blue-600/5 border-blue-500/20' },
            { to: '/admin/oracle', label: 'Submit Results', desc: 'Post match results and player stats on-chain', icon: TrendingUp, color: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/20' },
          ].map(({ to, label, desc, icon: Icon, color }) => (
            <Link key={to} to={to} className={`bg-gradient-to-br ${color} border rounded-2xl p-5 hover:scale-[1.02] transition-all group`}>
              <Icon size={20} className="text-white/70 mb-2" />
              <div className="text-sm font-semibold text-white">{label}</div>
              <div className="text-2xs text-zinc-400 mt-1">{desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
