import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { fetchAgentProfile } from '../store/slices/agentSlice';
import { shortenAddress, formatTimestamp, formatScore, formatBadge, formatWIRE, friendlyAction } from '../utils/format';
import { Bot, Play, Square, Zap, Brain, AlertCircle, CheckCircle, XCircle, Info, Clock, Activity, Shield, Target, TrendingUp, Users, Sparkles, Eye, Lightbulb, Send, Swords } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const BADGE_COLORS = {
  SAFE: 'badge-safe',
  MEDIUM: 'badge-medium',
  RISKY: 'badge-risky',
  UNKNOWN: 'badge bg-gray-500/20 text-gray-400',
};

function ReputationBadge({ score, size = 'lg' }) {
  const { value, colorClass } = formatScore(score);

  const sizeMap = {
    lg: 'w-28 h-28',
    sm: 'w-14 h-14',
  };
  const fontMap = {
    lg: 'text-3xl',
    sm: 'text-base',
  };
  const labelMap = {
    lg: 'text-2xs',
    sm: 'text-[8px]',
  };

  const borderColor =
    value >= 70
      ? 'border-emerald-400 shadow-glow-success'
      : value >= 40
        ? 'border-amber-400'
        : 'border-red-400 shadow-glow-error';

  return (
    <div
      className={`${sizeMap[size]} rounded-full border-[3px] ${borderColor} flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-sm`}
    >
      <span className={`${fontMap[size]} font-bold ${colorClass} leading-none`}>{value}</span>
      <span className={`${labelMap[size]} text-zinc-500 font-semibold uppercase tracking-widest mt-0.5`}>
        Score
      </span>
    </div>
  );
}

export default function AgentProfile() {
  const { agentId } = useParams();
  const dispatch = useDispatch();
  const [agent, setAgent] = useState(null);
  const [reputation, setReputation] = useState(null);
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Autonomous mode
  const [autoStatus, setAutoStatus] = useState({ running: false, logs: [] });
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoInterval, setAutoInterval] = useState(60);
  const [autoTypes, setAutoTypes] = useState(['MATCH_WINNER', 'TOP_SCORER']);

  useEffect(() => {
    // Also cache in Redux store for cross-page access
    dispatch(fetchAgentProfile(agentId));

    async function loadAgent() {
      try {
        const res = await fetch(`${API_BASE}/api/agents/${agentId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setAgent({
          owner: data.agent.owner,
          name: data.agent.name,
          botType: data.agent.botType,
          franchiseId: String(data.agent.franchiseId),
          active: data.agent.active,
          createdAt: String(data.agent.createdAt),
        });
        setReputation({
          score: data.reputation.score,
          badge: data.reputation.badge,
          successCount: Number(data.reputation.checkpoint?.successCount ?? 0),
          failureCount: Number(data.reputation.checkpoint?.failureCount ?? 0),
          violations: Number(data.reputation.checkpoint?.attemptedViolations ?? 0),
          totalGasUsed: String(data.reputation.checkpoint?.totalGasUsed ?? '0'),
        });
      } catch (err) {
        setFetchError(err.message || 'Failed to load agent data');
        setLoading(false);
        return;
      }

      try {
        const logsRes = await fetch(`${API_BASE}/api/agents/logs/${agentId}`);
        if (!logsRes.ok) throw new Error(`HTTP ${logsRes.status}`);
        const logs = await logsRes.json();
        setExecutions(
          logs.map((log, idx) => ({
            id: log.txHash || idx,
            action: log.action,
            target: log.target || '-',
            success: log.success,
            gas: Number(log.gasUsed).toLocaleString(),
            timestamp: log.timestamp,
            type: log.type,
            reason: log.reason,
            txHash: log.txHash,
          }))
        );
      } catch {
        setExecutions([]);
      }

      setLoading(false);
    }
    loadAgent();
  }, [agentId]);

  // Poll automation status
  const fetchAutoStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/agents/auto/${agentId}/status`);
      if (res.ok) setAutoStatus(await res.json());
    } catch {}
  }, [agentId]);

  useEffect(() => {
    fetchAutoStatus();
    const poll = setInterval(fetchAutoStatus, 5000);
    return () => clearInterval(poll);
  }, [fetchAutoStatus]);

  async function handleStartAuto() {
    setAutoLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/agents/auto/${agentId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botType: agent?.botType || 'PREDICTION',
          intervalSeconds: autoInterval,
          predictionTypes: autoTypes,
          maxActionsPerCycle: 1,
        }),
      });
      if (res.ok) await fetchAutoStatus();
    } catch {}
    setAutoLoading(false);
  }

  async function handleStopAuto() {
    setAutoLoading(true);
    try {
      await fetch(`${API_BASE}/api/agents/auto/${agentId}/stop`, { method: 'POST' });
      await fetchAutoStatus();
    } catch {}
    setAutoLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-10 h-10 border-4 border-primary-light border-t-transparent rounded-full" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="max-w-4xl mx-auto animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/dashboard" className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm">Dashboard</Link>
          <span className="text-zinc-700">/</span>
          <span className="text-zinc-400 text-sm">#{agentId}</span>
        </div>
        <div className="card-gradient text-center py-16">
          <h2 className="text-xl font-semibold text-red-400 mb-2">Agent Not Found</h2>
          <p className="text-sm text-zinc-500">Could not load agent #{agentId}. It may not exist or the server is unreachable.</p>
          <Link to="/dashboard" className="btn-secondary text-sm inline-block mt-6">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const badgeLabel = reputation ? formatBadge(reputation.badge) : 'UNKNOWN';

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/dashboard"
          className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm"
        >
          Dashboard
        </Link>
        <span className="text-zinc-700">/</span>
        <span className="text-zinc-400 text-sm">#{agentId}</span>
      </div>

      {/* Hero card */}
      <div className="card-gradient">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ReputationBadge score={reputation?.score} size="lg" />

          <div className="flex-1 text-center sm:text-left min-w-0">
            <div className="flex items-center gap-2.5 justify-center sm:justify-start flex-wrap">
              <h1 className="page-title">{agent?.name}</h1>
              <span className={BADGE_COLORS[badgeLabel]}>{badgeLabel}</span>
              {agent?.active ? (
                <span className="badge-safe">ACTIVE</span>
              ) : (
                <span className="badge bg-zinc-700/40 text-zinc-500">INACTIVE</span>
              )}
            </div>

            <p className="text-zinc-500 text-sm mt-1">Agent #{agentId}</p>

            <div className="flex items-center gap-3 mt-4 justify-center sm:justify-start flex-wrap">
              <Link to={`/policy/${agentId}`} className="btn-primary text-sm">
                Edit Policy
              </Link>
              <Link to={`/execute/${agentId}`} className="btn-secondary text-sm">
                Execute Action
              </Link>
              <a
                href={`https://wirefluidscan.com/address/${agent?.owner}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary-light hover:text-primary-light/80 transition-colors"
              >
                View on WireFluidScan
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Agent details */}
      <div>
        <h2 className="section-title mb-3">Agent Details</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card-surface">
            <p className="metric-label">Owner</p>
            <p className="metric-value font-mono text-sm">{shortenAddress(agent?.owner)}</p>
          </div>
          <div className="card-surface">
            <p className="metric-label">Agent Type</p>
            <p className="metric-value text-sm">{agent?.botType || 'UNKNOWN'}</p>
          </div>
          <div className="card-surface">
            <p className="metric-label">Franchise</p>
            <p className="metric-value text-sm">The Pindiz (#{agent?.franchiseId})</p>
          </div>
          <div className="card-surface">
            <p className="metric-label">Created</p>
            <p className="metric-value text-sm">{formatTimestamp(agent?.createdAt)}</p>
          </div>
        </div>
      </div>

      {/* Performance stats */}
      <div>
        <h2 className="section-title mb-3">Performance</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card-surface text-center">
            <p className="metric-value text-emerald-400">{reputation?.successCount ?? 0}</p>
            <p className="metric-label mt-1">Successes</p>
          </div>
          <div className="card-surface text-center">
            <p className="metric-value text-red-400">{reputation?.failureCount ?? 0}</p>
            <p className="metric-label mt-1">Failures</p>
          </div>
          <div className="card-surface text-center">
            <p className="metric-value text-amber-400">{reputation?.violations ?? 0}</p>
            <p className="metric-label mt-1">Violations</p>
          </div>
          <div className="card-surface text-center">
            <p className="metric-value text-zinc-300">{Number(reputation?.totalGasUsed ?? 0).toLocaleString()}</p>
            <p className="metric-label mt-1">Total Gas Used</p>
          </div>
        </div>
      </div>

      {/* Autonomous Mode */}
      <div className={`relative overflow-hidden rounded-2xl border ${autoStatus.running ? 'border-emerald-500/30 bg-zinc-900/90' : 'border-zinc-800/60 bg-zinc-900/70'} p-5 transition-all duration-500`}>
        {/* Animated background when running */}
        {autoStatus.running && (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.05] via-transparent to-primary/[0.03]" />
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-[60px] animate-pulse-glow" />
          </>
        )}

        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center ${autoStatus.running ? 'bg-emerald-400/15' : 'bg-zinc-800/80'}`}>
                <Brain size={20} className={autoStatus.running ? 'text-emerald-400' : 'text-zinc-500'} />
                {autoStatus.running && (
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 animate-ping opacity-75" />
                )}
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  Autonomous Mode
                  {autoStatus.running && (
                    <span className="inline-flex items-center gap-1 text-2xs font-medium text-emerald-400 bg-emerald-400/10 rounded-full px-2 py-0.5 border border-emerald-400/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
                    </span>
                  )}
                </h2>
                <p className="text-2xs text-zinc-500 mt-0.5">
                  {autoStatus.running ? 'AI is reasoning through cricket intelligence, ELO analysis, and on-chain execution' : 'Activate to let the AI reason and act autonomously'}
                </p>
              </div>
            </div>

            {autoStatus.running ? (
              <button
                onClick={handleStopAuto}
                disabled={autoLoading}
                className="flex items-center gap-1.5 text-xs font-medium text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-2 hover:bg-red-400/20 transition-colors disabled:opacity-50"
              >
                <Square size={12} /> Stop Agent
              </button>
            ) : (
              <button
                onClick={handleStartAuto}
                disabled={autoLoading}
                className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-lg px-4 py-2 hover:bg-emerald-400/20 transition-colors disabled:opacity-50 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
              >
                {autoLoading ? (
                  <><div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" /> Starting...</>
                ) : (
                  <><Play size={12} /> Start Autonomous</>
                )}
              </button>
            )}
          </div>

          {/* Config (only when stopped) */}
          {!autoStatus.running && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="form-label">Cycle Interval</label>
                <select value={autoInterval} onChange={(e) => setAutoInterval(Number(e.target.value))} className="input w-full text-xs">
                  <option value={30}>Every 30 seconds</option>
                  <option value={60}>Every 60 seconds</option>
                  <option value={120}>Every 2 minutes</option>
                  <option value={300}>Every 5 minutes</option>
                </select>
              </div>
              <div>
                <label className="form-label">Prediction Types</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {['MATCH_WINNER', 'TOP_SCORER', 'TOTAL_RUNS'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setAutoTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t])}
                      className={`text-2xs px-2 py-1 rounded-md font-medium transition-colors ${
                        autoTypes.includes(t)
                          ? 'bg-primary/20 text-primary-light border border-primary/30'
                          : 'bg-zinc-800/80 text-zinc-500 border border-zinc-700/50 hover:text-zinc-300'
                      }`}
                    >
                      {t.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Live running metrics */}
          {autoStatus.running && autoStatus.config && (
            <div className="grid grid-cols-5 gap-3 mb-4">
              <div className="bg-zinc-800/40 rounded-xl p-3 text-center">
                <Clock size={14} className="text-zinc-400 mx-auto mb-1" />
                <p className="text-xs font-bold text-white">{autoStatus.config.intervalSeconds}s</p>
                <p className="text-2xs text-zinc-600">Cycle</p>
              </div>
              <div className="bg-zinc-800/40 rounded-xl p-3 text-center">
                <Activity size={14} className="text-emerald-400 mx-auto mb-1" />
                <p className="text-xs font-bold text-white">{autoStatus.config.botType}</p>
                <p className="text-2xs text-zinc-600">Mode</p>
              </div>
              <div className="bg-zinc-800/40 rounded-xl p-3 text-center">
                <Target size={14} className="text-primary-light mx-auto mb-1" />
                <p className="text-xs font-bold text-white">{autoStatus.logs?.filter(l => l.type === 'success').length || 0}</p>
                <p className="text-2xs text-zinc-600">Successes</p>
              </div>
              <div className="bg-zinc-800/40 rounded-xl p-3 text-center">
                <Shield size={14} className="text-amber-400 mx-auto mb-1" />
                <p className="text-xs font-bold text-white">{autoStatus.logs?.filter(l => l.type === 'violation').length || 0}</p>
                <p className="text-2xs text-zinc-600">Violations</p>
              </div>
              <div className="bg-zinc-800/40 rounded-xl p-3 text-center">
                <Zap size={14} className="text-yellow-400 mx-auto mb-1" />
                <p className="text-xs font-bold text-white">{autoStatus.totalGasUsed ? (Number(autoStatus.totalGasUsed) / 1e9).toFixed(4) : '0'}</p>
                <p className="text-2xs text-zinc-600">Gas (WIRE)</p>
              </div>
            </div>
          )}

          {/* Cricket Intelligence Panel */}
          {autoStatus.running && autoStatus.insights?.topFormPlayers?.length > 0 && (
            <div className="bg-zinc-800/20 rounded-xl p-4 mb-4 border border-primary/10">
              <h3 className="text-xs font-semibold text-primary-light mb-4 flex items-center gap-1.5">
                <TrendingUp size={14} /> Cricket Intelligence
                <span className="ml-auto text-2xs text-zinc-600 font-normal bg-zinc-800/60 px-2 py-0.5 rounded-full">AI Engine</span>
              </h3>

              {/* Team Power Rankings */}
              {autoStatus.insights.eloRankings?.length > 0 && (
                <div className="mb-4">
                  <p className="text-2xs text-zinc-500 mb-2 font-medium">Team Power Rankings</p>
                  <div className="space-y-1.5">
                    {autoStatus.insights.eloRankings.slice(0, 6).map((t, i) => {
                      const teamWR = autoStatus.insights.teamStats?.find(ts => ts.team === t.team);
                      const maxElo = autoStatus.insights.eloRankings[0]?.elo || 1600;
                      const minElo = autoStatus.insights.eloRankings[autoStatus.insights.eloRankings.length - 1]?.elo || 1400;
                      const pct = Math.max(30, ((t.elo - minElo) / (maxElo - minElo || 1)) * 100);
                      return (
                        <div key={t.team} className="flex items-center gap-2">
                          <span className={`w-5 text-center text-2xs font-bold ${i === 0 ? 'text-yellow-400' : i < 3 ? 'text-emerald-400' : 'text-zinc-500'}`}>{i + 1}</span>
                          <span className="text-xs text-white w-36 truncate">{t.team}</span>
                          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${i === 0 ? 'bg-yellow-500' : i < 3 ? 'bg-emerald-500' : 'bg-zinc-600'}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-2xs text-zinc-400 w-9 text-right font-mono">{t.elo}</span>
                          {teamWR && (
                            <span className={`text-2xs w-16 text-right ${teamWR.winRate >= 60 ? 'text-emerald-400' : teamWR.winRate >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                              {teamWR.winRate}% · {teamWR.wins}W-{teamWR.total - teamWR.wins}L
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Venue Intelligence */}
              {autoStatus.insights.venueStats?.length > 0 && (
                <div className="mb-4">
                  <p className="text-2xs text-zinc-500 mb-2 font-medium flex items-center gap-1"><Eye size={10} /> Venue Intelligence</p>
                  <div className="space-y-1">
                    {autoStatus.insights.venueStats.map((v) => (
                      <div key={v.venue} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-zinc-800/30">
                        <span className="text-xs text-white truncate flex-1">{v.venue?.split(',')[0]}</span>
                        <span className="text-2xs text-zinc-500">{v.matches} matches</span>
                        <span className="text-2xs font-bold tabular-nums text-amber-400">{v.avgRuns} avg</span>
                        <span className={`text-2xs px-1.5 py-0.5 rounded font-medium ${v.type === 'batting-friendly' ? 'bg-emerald-500/20 text-emerald-400' : v.type === 'bowling-friendly' ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-700/50 text-zinc-400'}`}>
                          {v.type === 'batting-friendly' ? 'BAT' : v.type === 'bowling-friendly' ? 'BOWL' : 'BAL'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top H2H Rivalries */}
              {autoStatus.insights.topH2H?.length > 0 && (
                <div className="mb-4">
                  <p className="text-2xs text-zinc-500 mb-2 font-medium flex items-center gap-1"><Swords size={10} /> Head-to-Head Rivalries</p>
                  <div className="space-y-1">
                    {autoStatus.insights.topH2H.map((h) => {
                      const total = h.team1Wins + h.team2Wins;
                      const pct1 = total > 0 ? Math.round((h.team1Wins / total) * 100) : 50;
                      return (
                        <div key={`${h.team1}-${h.team2}`} className="py-1.5 px-2 rounded-lg bg-zinc-800/30">
                          <div className="flex items-center justify-between text-2xs mb-1">
                            <span className="text-white truncate">{h.team1}</span>
                            <span className="text-zinc-500">{h.meetings} matches</span>
                            <span className="text-white truncate text-right">{h.team2}</span>
                          </div>
                          <div className="flex h-1.5 rounded-full overflow-hidden bg-zinc-700">
                            <div className="bg-emerald-500 rounded-l-full" style={{ width: `${pct1}%` }} />
                            <div className="bg-violet-500 rounded-r-full" style={{ width: `${100 - pct1}%` }} />
                          </div>
                          <div className="flex justify-between text-2xs mt-0.5">
                            <span className="text-emerald-400 font-bold">{h.team1Wins}W</span>
                            <span className="text-violet-400 font-bold">{h.team2Wins}W</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Top Form Players */}
              <div className="mb-3">
                <p className="text-2xs text-zinc-500 mb-2 font-medium">Top Form Players</p>
                <div className="space-y-1">
                  {autoStatus.insights.topFormPlayers.slice(0, 5).map((p, i) => {
                    const roleColors = { BAT: 'bg-blue-500/20 text-blue-400', BOWL: 'bg-red-500/20 text-red-400', ALL: 'bg-emerald-500/20 text-emerald-400', WK: 'bg-amber-500/20 text-amber-400' };
                    return (
                      <div key={p.name} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors">
                        <span className="text-2xs font-bold text-zinc-500 w-4">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-white truncate">{p.name}</span>
                            <span className={`text-2xs px-1.5 py-0.5 rounded font-medium ${roleColors[p.role] || 'bg-zinc-700 text-zinc-400'}`}>{p.role}</span>
                          </div>
                          <span className="text-2xs text-zinc-500">{p.team}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-emerald-400">{p.avgFP}</p>
                          <p className="text-2xs text-zinc-600">{p.matches} matches · {p.battingAvg} avg</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* AI Decision Log */}
          {autoStatus.logs && autoStatus.logs.length > 0 && (
            <div className="border-t border-zinc-800/60 pt-3">
              <h3 className="text-2xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Sparkles size={12} className="text-primary-light" /> AI Reasoning Chain
                <span className="text-2xs text-zinc-600 normal-case font-normal ml-auto">{autoStatus.logs.length} entries</span>
              </h3>
              <div className="space-y-0.5 max-h-[500px] overflow-y-auto">
                {autoStatus.logs.slice(0, 40).map((log, i) => {
                  const icons = {
                    success: <CheckCircle size={12} className="text-emerald-400 shrink-0" />,
                    violation: <XCircle size={12} className="text-red-400 shrink-0" />,
                    error: <AlertCircle size={12} className="text-red-400 shrink-0" />,
                    decision: <Lightbulb size={12} className="text-amber-300 shrink-0" />,
                    thinking: <Brain size={12} className="text-violet-400 shrink-0 animate-pulse" />,
                    warning: <AlertCircle size={12} className="text-amber-400 shrink-0" />,
                    info: <Info size={12} className="text-zinc-500 shrink-0" />,
                  };
                  const bgColors = {
                    success: 'bg-emerald-400/5 border-l-2 border-l-emerald-400/40',
                    violation: 'bg-red-400/5 border-l-2 border-l-red-400/40',
                    error: 'bg-red-400/5 border-l-2 border-l-red-400/30',
                    decision: 'bg-amber-400/5 border-l-2 border-l-amber-400/40',
                    thinking: 'bg-violet-500/5 border-l-2 border-l-violet-400/40',
                    warning: 'bg-amber-400/5 border-l-2 border-l-amber-400/30',
                    info: 'border-l-2 border-l-zinc-700/40',
                  };
                  const textColors = {
                    success: 'text-emerald-300',
                    violation: 'text-red-300',
                    error: 'text-red-300',
                    decision: 'text-amber-200',
                    thinking: 'text-violet-300',
                    warning: 'text-amber-300',
                    info: 'text-zinc-400',
                  };
                  const actionLabels = {
                    PERCEIVE: 'Gathering Data',
                    ORACLE: 'On-Chain Query',
                    MEMORY: 'Checking History',
                    REASON: 'Analyzing',
                    DECIDE: 'Decision',
                    EXECUTE: 'Executing',
                    REFLECT: 'Reflecting',
                    SQUAD: 'Squad Building',
                    POLICY: 'Policy Check',
                    PREDICT: 'Prediction',
                    JOIN_CONTEST: 'Contest Entry',
                    CYCLE: 'New Cycle',
                    START: 'Activated',
                    STOP: 'Stopped',
                  };
                  return (
                    <div key={i} className={`flex items-start gap-2 py-2 px-3 rounded-r-lg ${bgColors[log.type] || bgColors.info} ${i === 0 && autoStatus.running ? 'animate-fade-in' : ''}`}>
                      <div className="mt-0.5">{icons[log.type] || icons.info}</div>
                      <div className="flex-1 min-w-0">
                        {log.type === 'thinking' && (
                          <span className="text-2xs text-violet-400/70 font-semibold uppercase tracking-wider">{actionLabels[log.action] || log.action}</span>
                        )}
                        {log.type === 'decision' && (
                          <span className="text-2xs text-amber-400/70 font-semibold uppercase tracking-wider">{actionLabels[log.action] || log.action}</span>
                        )}
                        <p className={`text-xs ${textColors[log.type] || 'text-zinc-400'} leading-relaxed ${log.type === 'thinking' ? 'italic' : ''}`}>
                          {log.outcome}
                        </p>
                        {log.reasoning && (
                          <p className="text-2xs text-zinc-500 mt-1 leading-relaxed bg-zinc-800/30 rounded px-2 py-1">{log.reasoning}</p>
                        )}
                      </div>
                      <span className="text-2xs text-zinc-700 shrink-0 tabular-nums mt-0.5">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {(!autoStatus.logs || autoStatus.logs.length === 0) && !autoStatus.running && (
            <div className="text-center py-8 border-t border-zinc-800/60 mt-2">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-emerald-400/10 flex items-center justify-center mx-auto mb-4">
                <Brain size={28} className="text-zinc-600" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-400 mb-1">AI Agent Ready</h3>
              <p className="text-xs text-zinc-600 max-w-sm mx-auto">
                Activate autonomous mode and the AI will reason through each decision step-by-step - gathering data, analyzing ELO ratings and player form, then executing on-chain actions through policy-enforced smart contracts.
              </p>
              <div className="flex items-center justify-center gap-6 mt-4 text-2xs text-zinc-600">
                <span className="flex items-center gap-1"><Target size={10} className="text-primary-light" /> Predictions</span>
                <span className="flex items-center gap-1"><Users size={10} className="text-secondary" /> Squad Challenges</span>
                <span className="flex items-center gap-1"><Shield size={10} className="text-amber-400" /> Policy Enforced</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Event log */}
      <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl">
        <div className="px-5 pt-5 pb-3">
          <h2 className="section-title">Recent Executions</h2>
        </div>
        <div className="divider" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="table-cell text-left">Action</th>
                <th className="table-cell text-left">Target</th>
                <th className="table-cell text-left">Status</th>
                <th className="table-cell text-left">Gas</th>
                <th className="table-cell text-left">Time</th>
              </tr>
            </thead>
            <tbody>
              {executions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-cell text-center text-zinc-500 py-8">
                    Execute actions to see history here
                  </td>
                </tr>
              ) : (
                executions.map((event) => (
                  <tr key={event.id} className="table-row">
                    <td className="table-cell text-sm text-primary-light font-medium">{friendlyAction(event.action)}</td>
                    <td className="table-cell text-zinc-300 font-mono text-xs">{event.target === '-' ? '-' : shortenAddress(event.target)}</td>
                    <td className="table-cell">
                      {event.type === 'violation' ? (
                        <span className="badge-risky">VIOLATION</span>
                      ) : event.success ? (
                        <span className="badge-safe">SUCCESS</span>
                      ) : (
                        <span className="badge-risky">FAILED</span>
                      )}
                    </td>
                    <td className="table-cell text-zinc-400">{event.gas}</td>
                    <td className="table-cell text-zinc-500 text-2xs">{formatTimestamp(event.timestamp)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
