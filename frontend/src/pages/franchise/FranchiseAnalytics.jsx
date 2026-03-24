import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useWallet } from '../../contexts/WalletContext';
import { BarChart3, TrendingUp, TrendingDown, Minus, Trophy, Target, Zap, MapPin, Swords, Activity } from 'lucide-react';

const H = (addr) => ({ 'x-wallet-address': addr || '' });
const ROLE_COLORS = { BAT: 'text-blue-400 bg-blue-500/10', BOWL: 'text-green-400 bg-green-500/10', ALL: 'text-purple-400 bg-purple-500/10', WK: 'text-yellow-400 bg-yellow-500/10' };

function TrendIcon({ trend }) {
  if (trend === 'rising') return <TrendingUp size={12} className="text-emerald-400" />;
  if (trend === 'declining') return <TrendingDown size={12} className="text-red-400" />;
  return <Minus size={12} className="text-zinc-500" />;
}

export default function FranchiseAnalytics() {
  const { address } = useWallet();
  const { franchise } = useOutletContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) return;
    fetch('/api/franchise-portal/analytics', { headers: H(address) })
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [address]);

  if (loading) return <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-24 bg-zinc-900/70 rounded-2xl animate-pulse" />)}</div>;

  if (!data) return <div className="bg-zinc-900/70 rounded-2xl p-12 text-center text-zinc-500 text-sm">Analytics unavailable</div>;

  const { teamElo, teamRecord, players, topFormPlayers, eloRankings, venueBreakdown, h2hRecords, momentumData } = data;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><BarChart3 size={22} className="text-violet-400" /> Team Analytics</h1>
        <p className="text-sm text-zinc-500 mt-1">6-Factor Intelligence: ELO, EWMA, H2H, Momentum, Venue, Role-Weighted</p>
      </div>

      {/* Team Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xs text-zinc-500 uppercase tracking-wider font-medium">ELO Rating</span>
            <Zap size={14} className="text-violet-400 opacity-50" />
          </div>
          <div className="text-2xl font-bold text-violet-400 tabular-nums">{teamElo || 1500}</div>
          <div className="text-2xs text-zinc-600 mt-1">Power ranking</div>
        </div>
        <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xs text-zinc-500 uppercase tracking-wider font-medium">Win Rate</span>
            <Trophy size={14} className="text-emerald-400 opacity-50" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 tabular-nums">{(teamRecord?.wins + teamRecord?.losses) > 0 ? `${teamRecord.winRate}%` : '-'}</div>
          <div className="text-2xs text-zinc-600 mt-1">{(teamRecord?.wins + teamRecord?.losses) > 0 ? `${teamRecord.wins}W - ${teamRecord.losses}L` : 'Season not started'}</div>
        </div>
        <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xs text-zinc-500 uppercase tracking-wider font-medium">Squad Size</span>
            <Target size={14} className="text-blue-400 opacity-50" />
          </div>
          <div className="text-2xl font-bold text-blue-400 tabular-nums">{players?.length || 0}</div>
          <div className="text-2xs text-zinc-600 mt-1">Active players</div>
        </div>
        <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xs text-zinc-500 uppercase tracking-wider font-medium">Avg Form</span>
            <TrendingUp size={14} className="text-amber-400 opacity-50" />
          </div>
          <div className="text-2xl font-bold text-amber-400 tabular-nums">
            {players?.length > 0 ? (players.reduce((s, p) => s + (Number(p.recent_form) || 0), 0) / players.filter(p => Number(p.recent_form) > 0).length || 0).toFixed(1) : '-'}
          </div>
          <div className="text-2xs text-zinc-600 mt-1">EWMA score</div>
        </div>
        {/* Momentum Card */}
        <div className={`bg-zinc-900/70 border rounded-2xl p-5 ${momentumData?.momentum >= 60 ? 'border-emerald-500/30' : momentumData?.momentum <= 40 ? 'border-red-500/30' : 'border-zinc-800/80'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xs text-zinc-500 uppercase tracking-wider font-medium">Momentum</span>
            <Activity size={14} className={`opacity-50 ${momentumData?.momentum >= 60 ? 'text-emerald-400' : momentumData?.momentum <= 40 ? 'text-red-400' : 'text-zinc-400'}`} />
          </div>
          <div className={`text-2xl font-bold tabular-nums ${momentumData?.momentum >= 60 ? 'text-emerald-400' : momentumData?.momentum <= 40 ? 'text-red-400' : 'text-zinc-300'}`}>
            {momentumData?.momentum ?? '-'}
          </div>
          <div className="text-2xs text-zinc-600 mt-1">
            {momentumData?.lastResults?.length > 0 ? (
              <span className="flex gap-0.5">
                {momentumData.lastResults.map((r, i) => (
                  <span key={i} className={`w-4 h-4 rounded text-center text-2xs font-bold leading-4 ${r === 'W' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{r}</span>
                ))}
              </span>
            ) : 'No data'}
          </div>
        </div>
      </div>

      {/* ELO Power Rankings */}
      {eloRankings?.length > 0 && (
        <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Zap size={16} className="text-violet-400" /> PSL Power Rankings (ELO)
          </h2>
          <div className="space-y-2">
            {eloRankings.map((t, i) => {
              const maxElo = eloRankings[0]?.elo || 1600;
              const minElo = eloRankings[eloRankings.length - 1]?.elo || 1400;
              const pct = Math.max(20, ((t.elo - minElo) / (maxElo - minElo || 1)) * 100);
              const isMyTeam = t.team?.toLowerCase().includes('pindiz');
              const played = t.matchesPlayed || (t.wins + t.losses) || 0;
              return (
                <div key={t.team} className={`flex items-center gap-3 py-2.5 px-3 rounded-lg ${isMyTeam ? 'bg-violet-500/10 border border-violet-500/20' : 'hover:bg-zinc-800/30'} transition-colors`}>
                  <span className={`w-6 text-center text-xs font-bold ${i === 0 ? 'text-yellow-400' : i < 3 ? 'text-emerald-400' : 'text-zinc-500'}`}>#{i + 1}</span>
                  <div className="w-44">
                    <span className={`text-sm truncate block ${isMyTeam ? 'text-violet-300 font-semibold' : 'text-white'}`}>{t.team}</span>
                    <span className="text-2xs text-zinc-600">{played > 0 ? `${t.wins}W-${t.losses}L · ${played} played` : 'No matches yet'}</span>
                  </div>
                  <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${played === 0 ? 'bg-zinc-700' : i === 0 ? 'bg-yellow-500' : i < 3 ? 'bg-emerald-500' : 'bg-zinc-600'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-zinc-400 w-10 text-right font-mono font-bold">{t.elo}</span>
                  <span className={`text-xs w-20 text-right ${played === 0 ? 'text-zinc-600' : t.winRate >= 60 ? 'text-emerald-400' : t.winRate >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                    {played > 0 ? `${t.winRate}% WR` : '-'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Venue Performance + Head-to-Head (side by side) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Venue Performance */}
        {venueBreakdown?.length > 0 && (
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <MapPin size={16} className="text-amber-400" /> Venue Performance
            </h2>
            <div className="space-y-2">
              {venueBreakdown.map((v) => (
                <div key={v.venue} className="py-2 px-3 rounded-lg hover:bg-zinc-800/30 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-white truncate flex-1">{v.venue?.split(',')[0]}</span>
                    <span className="text-2xs text-zinc-500 ml-2">{v.total} matches</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${v.winRate >= 60 ? 'bg-emerald-500' : v.winRate >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${v.winRate}%` }} />
                    </div>
                    <span className={`text-xs font-bold w-10 text-right ${v.winRate >= 60 ? 'text-emerald-400' : v.winRate >= 40 ? 'text-amber-400' : 'text-red-400'}`}>{v.winRate}%</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-2xs text-zinc-500">{v.wins}W - {v.losses}L</span>
                    <span className="text-2xs text-amber-400/70">{v.avgRuns > 0 ? `${v.avgRuns} avg runs` : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Head-to-Head Records */}
        {h2hRecords?.length > 0 && (
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Swords size={16} className="text-violet-400" /> Head-to-Head Records
            </h2>
            <div className="space-y-2">
              {h2hRecords.map((h) => (
                <div key={h.opponent} className="py-2 px-3 rounded-lg hover:bg-zinc-800/30 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-white truncate flex-1">vs {h.opponent}</span>
                    <span className="text-2xs text-zinc-500 ml-2">{h.total} matches</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden flex">
                      <div className="bg-emerald-500 h-full" style={{ width: `${h.winRate}%` }} />
                      <div className="bg-red-500/60 h-full" style={{ width: `${100 - h.winRate}%` }} />
                    </div>
                    <span className={`text-xs font-bold w-10 text-right ${h.winRate >= 60 ? 'text-emerald-400' : h.winRate >= 40 ? 'text-amber-400' : 'text-red-400'}`}>{h.winRate}%</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-2xs text-emerald-400">{h.wins}W</span>
                    <span className="text-2xs text-red-400">{h.losses}L</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Player Form Table */}
      <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-400" /> Player Form (EWMA)
          </h2>
          <p className="text-2xs text-zinc-500 mt-1">Exponentially weighted moving average - recent matches weighted higher</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-500 text-left border-y border-zinc-800">
              <th className="px-5 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Player</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium text-right">EWMA Form</th>
              <th className="px-4 py-3 font-medium text-right">Batting Avg</th>
              <th className="px-4 py-3 font-medium text-right">Matches</th>
              <th className="px-4 py-3 font-medium text-right">Trend</th>
              <th className="px-4 py-3 font-medium text-right">Credits</th>
              <th className="px-4 py-3 font-medium text-right">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {(players || [])
              .sort((a, b) => (Number(b.recent_form) || 0) - (Number(a.recent_form) || 0))
              .map((p, i) => {
                const form = Number(p.recent_form) || 0;
                const credits = Number(p.credits) || 1;
                const valueRatio = form > 0 ? (form / credits).toFixed(2) : '-';
                const trend = form > Number(p.batting_avg || 0) * 1.1 ? 'rising' : form < Number(p.batting_avg || 0) * 0.85 ? 'declining' : 'steady';
                return (
                  <tr key={p.player_id} className="hover:bg-zinc-800/30">
                    <td className="px-5 py-2.5 text-zinc-500 text-xs">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-white">{p.name}</td>
                    <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-2xs font-medium ${ROLE_COLORS[p.role] || ''}`}>{p.role}</span></td>
                    <td className="px-4 py-2.5 text-right font-bold text-emerald-400 tabular-nums">{form > 0 ? form.toFixed(1) : '-'}</td>
                    <td className="px-4 py-2.5 text-right text-zinc-400 tabular-nums">{Number(p.batting_avg) > 0 ? Number(p.batting_avg).toFixed(1) : '-'}</td>
                    <td className="px-4 py-2.5 text-right text-zinc-400 tabular-nums">{p.matches_played || 0}</td>
                    <td className="px-4 py-2.5 text-right"><TrendIcon trend={trend} /></td>
                    <td className="px-4 py-2.5 text-right text-violet-400 font-bold tabular-nums">{credits}</td>
                    <td className="px-4 py-2.5 text-right text-amber-400 tabular-nums font-medium">{valueRatio}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
