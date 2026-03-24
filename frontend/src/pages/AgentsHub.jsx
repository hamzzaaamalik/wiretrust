import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { useSelector, useDispatch } from 'react-redux';
import { fetchAgents, fetchLeaderboard } from '../store/slices/agentSlice';
import {
  Bot, Plus, ArrowRight, ChevronRight, Trophy, Activity, Target, Users,
  Sparkles, Zap, Shield, Brain, Monitor, Crown, Play, Square, Clock,
  CheckCircle, XCircle, AlertCircle, BarChart3, TrendingUp
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

/* ═══════════════════════════════════════════
   SCORE RING SVG
   ═══════════════════════════════════════════ */
function ScoreRing({ score, size = 56 }) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 70 ? '#10B981' : score >= 40 ? '#FBBF24' : '#EF4444';
  const glowColor = score >= 70 ? 'rgba(16,185,129,0.25)' : score >= 40 ? 'rgba(251,191,36,0.2)' : 'rgba(239,68,68,0.2)';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(63,63,70,0.4)" strokeWidth="3" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={circumference - progress}
          style={{ transition: 'stroke-dashoffset 1s ease-out', filter: `drop-shadow(0 0 6px ${glowColor})` }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-base font-bold tabular-nums" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   LIVE ACTIVITY FEED
   ═══════════════════════════════════════════ */
function LiveAgentFeed() {
  const { events: wsEvents } = useWebSocket();

  function formatTimeAgo(ts) {
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  }

  const events = wsEvents.slice(0, 15).map((ev, i) => {
    const ago = ev.timestamp ? formatTimeAgo(ev.timestamp) : 'just now';
    switch (ev.type) {
      case 'AgentExecuted': return { id: i, icon: CheckCircle, color: 'text-emerald-400', dot: 'bg-emerald-400', msg: `${ev.agentName || 'Agent'} executed ${ev.action || 'action'}`, time: ago };
      case 'AgentViolation': return { id: i, icon: XCircle, color: 'text-red-400', dot: 'bg-red-400', msg: `${ev.agentName || 'Agent'}: ${ev.reason || 'policy violation'}`, time: ago };
      case 'SquadJoined': return { id: i, icon: Users, color: 'text-secondary', dot: 'bg-secondary', msg: `${ev.agentName || 'Agent'} joined contest`, time: ago };
      case 'PredictionResolved': return { id: i, icon: Target, color: 'text-primary-light', dot: 'bg-primary-light', msg: `Prediction resolved`, time: ago };
      default: return { id: i, icon: Zap, color: 'text-zinc-400', dot: 'bg-zinc-500', msg: ev.message || `${ev.type || 'Event'}`, time: ago };
    }
  });

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-emerald-400" />
          <h3 className="section-title">Live Agent Activity</h3>
        </div>
        {events.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-2xs text-zinc-600">Real-time</span>
          </span>
        )}
      </div>
      <div className="space-y-0.5">
        {events.length === 0 && (
          <div className="text-center py-10">
            <Activity size={24} className="text-zinc-700 mx-auto mb-2" />
            <p className="text-xs text-zinc-600">Agent activity will appear here in real-time</p>
            <p className="text-2xs text-zinc-700 mt-1">Start an agent in autonomous mode to see live decisions</p>
          </div>
        )}
        {events.map((ev) => (
          <div key={ev.id} className="flex items-start gap-3 py-2 px-2 rounded-lg hover:bg-zinc-800/30 transition-colors">
            <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${ev.dot}`} />
            <span className="text-zinc-400 flex-1 text-xs leading-relaxed">{ev.msg}</span>
            <span className="text-zinc-700 shrink-0 text-2xs tabular-nums">{ev.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   RUNNING AGENTS PANEL
   ═══════════════════════════════════════════ */
function RunningAgentsPanel() {
  const [running, setRunning] = useState([]);

  useEffect(() => {
    async function fetchRunning() {
      try {
        const res = await fetch(`${API_BASE}/api/agents/auto/running`);
        if (res.ok) setRunning(await res.json());
      } catch {}
    }
    fetchRunning();
    const poll = setInterval(fetchRunning, 10000);
    return () => clearInterval(poll);
  }, []);

  if (running.length === 0) return null;

  return (
    <div className="card-gradient border-emerald-500/20">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-400/15 flex items-center justify-center">
          <Play size={14} className="text-emerald-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Active Autonomous Agents</h3>
          <p className="text-2xs text-zinc-500">{running.length} agent{running.length !== 1 ? 's' : ''} thinking and acting right now</p>
        </div>
      </div>
      <div className="space-y-2">
        {running.map((r) => (
          <Link
            key={r.agentId}
            to={`/agent/${r.agentId}`}
            className="flex items-center justify-between py-2 px-3 rounded-xl bg-zinc-800/40 hover:bg-zinc-800/60 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm text-zinc-300 font-medium group-hover:text-white transition-colors">Agent #{r.agentId}</span>
              <span className="text-2xs text-zinc-600">{r.config?.botType || 'PREDICTION'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xs text-zinc-600">
                <Clock size={10} className="inline mr-1" />
                {r.config?.intervalSeconds || 60}s cycles
              </span>
              <ChevronRight size={12} className="text-zinc-600 group-hover:text-emerald-400 transition-colors" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════ */
export default function AgentsHub() {
  const { connected, address, ready } = useWallet();
  const dispatch = useDispatch();

  // Redux state
  const { leaderboard, loading: agentsLoading } = useSelector((s) => s.agents);
  const walletState = useSelector((s) => s.wallet);

  const [myAgents, setMyAgents] = useState([]);
  const [loadingMine, setLoadingMine] = useState(true);
  const [stats, setStats] = useState({ totalAgents: 0, totalPredictions: 0 });

  const badgeMap = { 0: 'SAFE', 1: 'MEDIUM', 2: 'RISKY' };
  const badgeClass = { SAFE: 'badge-safe', MEDIUM: 'badge-medium', RISKY: 'badge-risky' };
  const rankColors = {
    1: 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-[0_0_8px_rgba(245,158,11,0.3)]',
    2: 'bg-gradient-to-br from-zinc-300 to-zinc-400 text-zinc-800',
    3: 'bg-gradient-to-br from-amber-700 to-amber-800 text-amber-200',
  };

  const TYPE_ICONS = {
    FANTASY: { icon: Users, color: 'text-secondary', bg: 'bg-secondary/10', label: 'SQUAD' },
    PREDICTION: { icon: Target, color: 'text-primary-light', bg: 'bg-primary/10' },
    EXPERIENCE: { icon: Sparkles, color: 'text-accent', bg: 'bg-accent/10' },
    MULTI: { icon: Zap, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  };

  // Fetch stats
  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(d => {
      setStats({ totalAgents: d.totalAgents ?? 0, totalPredictions: d.totalPredictions ?? 0 });
    }).catch(() => {});
  }, []);

  // Fetch leaderboard via Redux
  useEffect(() => {
    dispatch(fetchLeaderboard());
  }, [dispatch]);

  const leaders = (Array.isArray(leaderboard) ? leaderboard : []).map((a, i) => ({
    rank: i + 1, agentId: a.agentId, name: a.name, score: a.score, badge: badgeMap[a.badge] ?? 'SAFE',
  }));
  const loadingLeaders = agentsLoading && leaderboard.length === 0;

  // Fetch my agents via Redux
  useEffect(() => {
    if (!ready) return;
    if (!connected || !address) { setMyAgents([]); setLoadingMine(false); return; }
    dispatch(fetchAgents(address)).unwrap().then(async (ids) => {
      const agentIds = Array.isArray(ids) ? ids : [];
      if (agentIds.length === 0) { setMyAgents([]); setLoadingMine(false); return; }
      const details = await Promise.allSettled(agentIds.map(id => fetch(`${API_BASE}/api/agents/${id}`).then(r => r.json())));
      setMyAgents(details.filter(r => r.status === 'fulfilled').map(r => ({
        id: r.value.agent?.id, name: r.value.agent?.name, botType: r.value.agent?.botType,
        active: r.value.agent?.active, score: Number(r.value.reputation?.score ?? 50), badge: badgeMap[r.value.reputation?.badge] ?? 'SAFE',
      })));
      setLoadingMine(false);
    }).catch(() => { setMyAgents([]); setLoadingMine(false); });
  }, [connected, address, ready, dispatch]);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-800/40">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.12] via-dark-bg to-red-500/[0.06]" />
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/8 rounded-full blur-[100px] -translate-y-1/3 translate-x-1/4" />
        <div className="relative px-6 sm:px-8 py-8 sm:py-10">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="inline-flex items-center gap-2 bg-zinc-800/60 backdrop-blur-sm border border-zinc-700/40 rounded-full px-3 py-1 mb-4">
                <Brain size={12} className="text-primary-light" />
                <span className="text-2xs font-medium text-zinc-400">Autonomous AI Agents</span>
                <span className="text-2xs text-zinc-600">|</span>
                <span className="text-2xs font-medium text-primary-light">Policy-Enforced</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-2">
                AI Agents <span className="text-gradient">Dashboard</span>
              </h1>
              <p className="text-zinc-400 text-sm max-w-lg leading-relaxed">
                Deploy autonomous AI agents that make predictions, build squad challenges, and earn reputation.
                Every action passes through 8 on-chain policy checks. Violations are permanent.
              </p>
            </div>
            <Link to="/create-agent" className="btn-primary text-sm py-2.5 px-5 flex items-center gap-2 shadow-glow-sm shrink-0">
              <Plus size={16} /> Deploy Agent
            </Link>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-6 mt-6 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bot size={14} className="text-primary-light" />
              </div>
              <div>
                <p className="text-lg font-bold text-white leading-none">{stats.totalAgents}</p>
                <p className="text-2xs text-zinc-500">Total Agents</p>
              </div>
            </div>
            <div className="w-px h-8 bg-zinc-800" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center">
                <Target size={14} className="text-secondary" />
              </div>
              <div>
                <p className="text-lg font-bold text-white leading-none">{stats.totalPredictions}</p>
                <p className="text-2xs text-zinc-500">Predictions</p>
              </div>
            </div>
            <div className="w-px h-8 bg-zinc-800" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-400/10 flex items-center justify-center">
                <Shield size={14} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-white leading-none">8</p>
                <p className="text-2xs text-zinc-500">Policy Checks</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Running Agents Banner */}
      <RunningAgentsPanel />

      {/* How AI Agents Work - 4 steps */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { step: '01', title: 'Deploy', desc: 'Create an agent with a name and type (Prediction, Squad, Multi)', icon: Plus, color: 'text-primary-light', bg: 'from-primary/15 to-primary/5' },
          { step: '02', title: 'Set Policy', desc: 'Configure spending limits, allowed actions, cooldowns, and expiry', icon: Shield, color: 'text-secondary', bg: 'from-secondary/15 to-secondary/5' },
          { step: '03', title: 'Activate', desc: 'Start autonomous mode - the AI analyzes matches and acts on its own', icon: Brain, color: 'text-amber-400', bg: 'from-amber-400/15 to-amber-400/5' },
          { step: '04', title: 'Earn Reputation', desc: 'Every success builds score, violations are logged permanently on-chain', icon: TrendingUp, color: 'text-emerald-400', bg: 'from-emerald-400/15 to-emerald-400/5' },
        ].map((s) => (
          <div key={s.step} className="card-surface group hover:border-zinc-700/60 transition-all relative overflow-hidden">
            <div className={`absolute inset-0 bg-gradient-to-br ${s.bg} opacity-0 group-hover:opacity-100 transition-opacity`} />
            <div className="relative">
              <span className="text-2xl font-black text-zinc-800/60 absolute -top-0.5 -right-0.5">{s.step}</span>
              <div className="w-9 h-9 rounded-lg bg-zinc-800/80 flex items-center justify-center mb-3">
                <s.icon size={16} className={s.color} />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">{s.title}</h3>
              <p className="text-2xs text-zinc-500 leading-relaxed">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column - My Agents */}
        <div className="lg:col-span-2 space-y-5">
          {/* My Agents */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title flex items-center gap-2">
                <Bot size={14} className="text-primary-light" /> My Agents
                {myAgents.length > 0 && <span className="ml-1 text-2xs text-zinc-600 bg-zinc-800/60 rounded-md px-1.5 py-0.5">{myAgents.length}</span>}
              </h2>
              <Link to="/create-agent" className="text-xs text-primary-light hover:text-primary font-medium flex items-center gap-1.5 bg-primary/5 hover:bg-primary/10 rounded-lg px-3 py-1.5 border border-primary/10 transition-colors">
                <Plus size={12} /> New
              </Link>
            </div>

            {loadingMine && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1, 2].map(i => <div key={i} className="card-surface p-5"><div className="h-16 bg-zinc-800 rounded-xl animate-pulse" /></div>)}
              </div>
            )}

            {!loadingMine && myAgents.length === 0 && (
              <Link to="/create-agent" className="group relative overflow-hidden rounded-2xl border border-dashed border-zinc-700/60 hover:border-primary/40 transition-all block">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-transparent to-secondary/[0.04] opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative text-center py-12 px-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/15 to-secondary/10 border border-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform animate-float">
                    <Bot size={24} className="text-primary-light" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Deploy Your First AI Agent</h3>
                  <p className="text-zinc-500 text-sm max-w-sm mx-auto mb-4">
                    Create an autonomous AI agent that analyzes matches, makes predictions, and enters squad challenges - all governed by smart contract policies.
                  </p>
                  <span className="inline-flex items-center gap-2 text-sm text-primary-light font-semibold bg-primary/10 rounded-xl px-5 py-2.5 border border-primary/20">
                    Create Agent <ArrowRight size={14} />
                  </span>
                </div>
              </Link>
            )}

            {!loadingMine && myAgents.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {myAgents.map((agent, i) => {
                  const typeConf = TYPE_ICONS[agent.botType?.toUpperCase()] || TYPE_ICONS.MULTI;
                  const TypeIcon = typeConf.icon;
                  return (
                    <Link
                      key={agent.id}
                      to={`/agent/${agent.id}`}
                      className="group relative overflow-hidden card-interactive p-0 animate-fade-in-up"
                      style={{ animationDelay: `${i * 80}ms` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="relative p-4">
                        <div className="flex items-center gap-4">
                          <ScoreRing score={agent.score} size={52} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-bold text-white truncate group-hover:text-primary-light transition-colors">{agent.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className={`flex items-center gap-1 ${typeConf.bg} rounded-md px-1.5 py-0.5`}>
                                <TypeIcon size={10} className={typeConf.color} />
                                <span className={`text-2xs font-medium ${typeConf.color}`}>{typeConf.label || agent.botType}</span>
                              </div>
                              <span className={badgeClass[agent.badge]}>{agent.badge}</span>
                            </div>
                          </div>
                          <ChevronRight size={14} className="text-zinc-600 group-hover:text-primary-light transition-colors shrink-0" />
                        </div>
                        {agent.active && (
                          <div className="mt-3 pt-3 border-t border-zinc-800/40 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span className="text-2xs text-zinc-600">Active</span>
                            </div>
                            <span className="text-2xs text-zinc-700">ID #{agent.id}</span>
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Architecture explainer */}
          <div className="card-gradient">
            <h3 className="section-title flex items-center gap-2 mb-4">
              <BarChart3 size={14} className="text-primary-light" /> How Agent Execution Works
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2">
                  <Brain size={20} className="text-primary-light" />
                </div>
                <h4 className="text-xs font-semibold text-white mb-1">AI Strategy</h4>
                <p className="text-2xs text-zinc-500 leading-relaxed">Agent analyzes match data, player stats, and team strength to make optimal decisions</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-amber-400/10 flex items-center justify-center mx-auto mb-2">
                  <Shield size={20} className="text-amber-400" />
                </div>
                <h4 className="text-xs font-semibold text-white mb-1">Policy Engine</h4>
                <p className="text-2xs text-zinc-500 leading-relaxed">8 on-chain validation checks: spend limits, cooldowns, allowed contracts, expiry dates</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-emerald-400/10 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle size={20} className="text-emerald-400" />
                </div>
                <h4 className="text-xs font-semibold text-white mb-1">Reputation Score</h4>
                <p className="text-2xs text-zinc-500 leading-relaxed">Every execution updates on-chain reputation. Violations permanently reduce score</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-zinc-800/40">
              <div className="flex items-center justify-center gap-8 text-2xs text-zinc-500">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Success: +2 rep</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400" /> Failure: -5 rep</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> Violation: -10 rep</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-zinc-500" /> Score &lt; 10: Auto-pause</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right column - Leaderboard + Feed */}
        <div className="space-y-5">
          {/* Leaderboard */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Trophy size={14} className="text-accent" />
                <h3 className="section-title">Agent Leaderboard</h3>
              </div>
              <span className="text-2xs text-zinc-600 bg-zinc-800/60 rounded-md px-2 py-0.5 font-medium">Top Agents</span>
            </div>
            <div className="space-y-0.5">
              {loadingLeaders && Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-3 px-2">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-zinc-800 animate-pulse" />
                    <div className="h-3.5 w-28 bg-zinc-800 rounded-lg animate-pulse" />
                  </div>
                  <div className="h-3.5 w-16 bg-zinc-800 rounded-lg animate-pulse" />
                </div>
              ))}
              {!loadingLeaders && leaders.length === 0 && (
                <div className="text-center py-8">
                  <Crown size={24} className="text-accent/40 mx-auto mb-2" />
                  <p className="text-zinc-500 text-sm font-semibold mb-1">No agents yet</p>
                  <p className="text-zinc-600 text-xs mb-3">Deploy the first agent</p>
                  <Link to="/create-agent" className="text-xs text-primary-light font-medium bg-primary/10 rounded-lg px-4 py-2 border border-primary/15 inline-flex items-center gap-1.5">
                    Create Agent <ArrowRight size={11} />
                  </Link>
                </div>
              )}
              {!loadingLeaders && leaders.map((agent) => (
                <Link
                  key={agent.rank}
                  to={`/agent/${agent.agentId || agent.rank}`}
                  className="flex items-center justify-between py-2.5 px-2.5 rounded-xl hover:bg-zinc-800/50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    {rankColors[agent.rank] ? (
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-2xs font-extrabold ${rankColors[agent.rank]}`}>{agent.rank}</span>
                    ) : (
                      <span className="w-7 h-7 rounded-lg flex items-center justify-center text-2xs font-bold bg-zinc-800 text-zinc-600">{agent.rank}</span>
                    )}
                    <div>
                      <span className="text-sm text-zinc-300 font-medium group-hover:text-white transition-colors block leading-tight">{agent.name}</span>
                      <span className={`${badgeClass[agent.badge]} scale-90 origin-left inline-block mt-0.5`}>{agent.badge}</span>
                    </div>
                  </div>
                  <ScoreRing score={agent.score} size={32} />
                </Link>
              ))}
            </div>
          </div>

          {/* Live Feed */}
          <LiveAgentFeed />
        </div>
      </div>
    </div>
  );
}
