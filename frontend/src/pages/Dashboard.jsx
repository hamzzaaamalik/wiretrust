import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { useSelector, useDispatch } from 'react-redux';
import { fetchLiveMatches, fetchMatches } from '../store/slices/matchSlice';
import { fetchContests } from '../store/slices/fantasySlice';
import {
  Monitor, TrendingUp, Image, Users, Zap, Plus, ArrowRight, ChevronRight,
  Trophy, Activity, Flame, Target, Sparkles, Shield, Gift, BarChart3,
  Gamepad2, Crown, BookOpen, CheckCircle2, Wallet, Star, Award
} from 'lucide-react';
import PageGuide from '../components/common/PageGuide';

/* ═══════════════════════════════════════════
   ANIMATED COUNTER HOOK
   ═══════════════════════════════════════════ */
function useAnimatedCounter(target, duration = 1200) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const num = typeof target === 'number' ? target : parseInt(target);
    if (isNaN(num) || num === 0) { setCount(target); return; }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        const animate = (now) => {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setCount(Math.round(eased * num));
          if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
      }
    }, { threshold: 0.3 });

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);

  return { count, ref };
}

/* ═══════════════════════════════════════════
   LIVE MATCH BANNER
   ═══════════════════════════════════════════ */
function LiveMatchBanner() {
  const dispatch = useDispatch();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLiveMatch() {
      try {
        // Also populate Redux store
        dispatch(fetchLiveMatches());
        const res = await fetch('/api/matches/live');
        if (res.ok) setMatch(await res.json());
      } catch {}
      setLoading(false);
    }
    fetchLiveMatch();
    const interval = setInterval(fetchLiveMatch, 30000);
    return () => clearInterval(interval);
  }, [dispatch]);

  if (loading) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-zinc-800/60">
        <div className="relative px-5 py-5 flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-zinc-700 animate-pulse" />
          <div className="h-4 w-48 bg-zinc-800 rounded animate-pulse" />
          <div className="ml-auto h-8 w-28 bg-zinc-800 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }
  if (!match) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 animate-fade-in">
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.07] via-transparent to-primary/[0.07]" />
      <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
      <div className="relative px-5 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="live-dot" />
            <span className="text-2xs font-bold text-emerald-400 uppercase tracking-widest">Live</span>
          </div>
          <div className="w-px h-5 bg-zinc-700/60" />
          <div>
            <span className="text-white font-semibold text-sm">{match.team1} vs {match.team2}</span>
            {match.score && <span className="text-zinc-400 text-sm ml-2">{match.score}</span>}
            {match.overs && <span className="text-zinc-500 text-xs ml-1.5">({match.overs} ov)</span>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/predict" className="btn-secondary text-xs py-1.5 px-3">Predict</Link>
          <Link to="/squad-challenge" className="btn-primary text-xs py-1.5 px-3">Join Contest</Link>
        </div>
      </div>
    </div>
  );
}

/* Landing page components (HeroSection, HowItWorks, etc.) moved to Home.jsx */
/* ═══════════════════════════════════════════
   STATS BAR (Connected - compact)
   ═══════════════════════════════════════════ */
function StatsBar({ stats }) {
  const items = [
    { key: 'totalAgents', label: 'Agents', icon: Monitor, color: 'text-primary-light', bg: 'bg-primary/10' },
    { key: 'totalPredictions', label: 'Predictions', icon: Target, color: 'text-secondary', bg: 'bg-secondary/10' },
    { key: 'totalNFTs', label: 'NFTs', icon: Image, color: 'text-accent', bg: 'bg-accent/10' },
    { key: 'activeContests', label: 'Contests', icon: Flame, color: 'text-red-400', bg: 'bg-red-500/10' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((item, i) => (
        <div key={item.key} className="card-surface flex items-center gap-3 animate-fade-in-up" style={{ animationDelay: `${i * 50}ms` }}>
          <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center shrink-0`}>
            <item.icon size={16} strokeWidth={1.5} className={item.color} />
          </div>
          <div>
            <p className="text-lg font-bold text-white tabular-nums leading-none">{stats[item.key]}</p>
            <p className="text-2xs text-zinc-500 font-medium mt-0.5">{item.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   SCORE RING SVG (circular progress)
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
   MY AGENTS (Connected)
   ═══════════════════════════════════════════ */
function MyAgentsSection({ agents, loading }) {
  const TYPE_ICONS = {
    FANTASY: { icon: Users, color: 'text-secondary', bg: 'bg-secondary/10', label: 'SQUAD' },
    PREDICTION: { icon: Target, color: 'text-primary-light', bg: 'bg-primary/10', label: 'PREDICTION' },
    EXPERIENCE: { icon: Sparkles, color: 'text-accent', bg: 'bg-accent/10', label: 'EXPERIENCE' },
    MULTI: { icon: Zap, color: 'text-amber-400', bg: 'bg-amber-400/10', label: 'MULTI' },
  };

  if (loading) {
    return (
      <div className="animate-fade-in-up">
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title flex items-center gap-2"><Monitor size={14} className="text-primary-light" /> My Agents</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2].map(i => (
            <div key={i} className="card-surface p-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-zinc-800 animate-pulse" />
                <div className="flex-1 space-y-2.5">
                  <div className="h-4 w-36 bg-zinc-800 rounded-lg animate-pulse" />
                  <div className="h-3 w-24 bg-zinc-800/60 rounded-lg animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="animate-fade-in-up">
        <Link to="/create-agent" className="group relative overflow-hidden rounded-2xl border border-dashed border-zinc-700/60 hover:border-primary/40 transition-all duration-300 block">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-transparent to-secondary/[0.04] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative text-center py-12 px-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/15 to-secondary/10 border border-primary/10 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 animate-float">
              <div className="relative">
                <Monitor size={28} className="text-primary-light" strokeWidth={1.5} />
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-secondary/20 border border-secondary/30 flex items-center justify-center">
                  <Plus size={10} className="text-secondary" />
                </div>
              </div>
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Deploy Your First AI Agent</h3>
            <p className="text-zinc-500 text-sm max-w-md mx-auto mb-6 leading-relaxed">
              Create an autonomous AI agent with policy guardrails. It acts on your behalf in squad challenges, predictions and NFT collection. Every action is verified on WireFluid.
            </p>
            <div className="flex items-center justify-center gap-6 mb-6">
              {[
                { icon: Shield, label: '8 Policy Checks', color: 'text-emerald-400' },
                { icon: BarChart3, label: 'Live Reputation', color: 'text-primary-light' },
                { icon: Activity, label: 'On-Chain Audit', color: 'text-accent' },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-1.5">
                  <f.icon size={12} className={f.color} />
                  <span className="text-2xs text-zinc-600 font-medium">{f.label}</span>
                </div>
              ))}
            </div>
            <span className="inline-flex items-center gap-2 text-sm text-primary-light font-semibold group-hover:gap-3 transition-all bg-primary/10 rounded-xl px-5 py-2.5 border border-primary/20">
              Create Agent <ArrowRight size={14} />
            </span>
          </div>
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title flex items-center gap-2">
          <Monitor size={14} className="text-primary-light" /> My Agents
          <span className="ml-1 text-2xs text-zinc-600 bg-zinc-800/60 rounded-md px-1.5 py-0.5 font-medium">{agents.length}</span>
        </h3>
        <Link to="/create-agent" className="text-xs text-primary-light hover:text-primary font-medium transition-colors flex items-center gap-1.5 bg-primary/5 hover:bg-primary/10 rounded-lg px-3 py-1.5 border border-primary/10">
          <Plus size={12} /> New Agent
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {agents.map((agent, i) => {
          const badgeLabel = agent.badge === 0 ? 'SAFE' : agent.badge === 1 ? 'MEDIUM' : 'RISKY';
          const badgeClass = agent.badge === 0 ? 'badge-safe' : agent.badge === 1 ? 'badge-medium' : 'badge-risky';
          const typeConf = TYPE_ICONS[agent.botType?.toUpperCase()] || TYPE_ICONS.MULTI;
          const TypeIcon = typeConf.icon;

          return (
            <Link
              key={agent.id}
              to={`/agent/${agent.id}`}
              className="group relative overflow-hidden card-interactive p-0 animate-fade-in-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {/* Hover gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="relative p-4 sm:p-5">
                <div className="flex items-center gap-4">
                  {/* Score Ring */}
                  <ScoreRing score={agent.score} size={56} />

                  {/* Agent Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-white truncate group-hover:text-primary-light transition-colors">{agent.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-1 ${typeConf.bg} rounded-md px-1.5 py-0.5`}>
                        <TypeIcon size={10} className={typeConf.color} />
                        <span className={`text-2xs font-medium ${typeConf.color}`}>{typeConf.label || agent.botType}</span>
                      </div>
                      <span className={badgeClass}>{badgeLabel}</span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="w-8 h-8 rounded-lg bg-zinc-800/40 group-hover:bg-primary/10 flex items-center justify-center shrink-0 transition-all duration-200">
                    <ChevronRight size={14} className="text-zinc-600 group-hover:text-primary-light group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>

                {/* Bottom bar - active indicator */}
                {agent.active && (
                  <div className="mt-3 pt-3 border-t border-zinc-800/40 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-2xs text-zinc-600 font-medium">Active</span>
                    </div>
                    <span className="text-2xs text-zinc-700 font-medium">ID #{agent.id}</span>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   QUICK ACTIONS (Connected)
   ═══════════════════════════════════════════ */
function QuickActions() {
  const actions = [
    { to: '/squad-challenge', label: 'Squad Challenge', desc: 'Build your best XI', icon: Users, color: 'text-secondary', bg: 'bg-secondary/10', free: true },
    { to: '/predict', label: 'Predict', desc: 'Earn points & badges', icon: TrendingUp, color: 'text-primary-light', bg: 'bg-primary/10', free: true },
    { to: '/marketplace', label: 'Challenges', desc: 'Earn NFT rewards', icon: Award, color: 'text-accent', bg: 'bg-accent/10' },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {actions.map((item, i) => (
        <Link key={item.to} to={item.to} className="card-interactive text-center py-4 sm:py-5 group animate-fade-in-up" style={{ animationDelay: `${i * 60}ms` }}>
          <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center mx-auto mb-2 sm:mb-2.5 group-hover:scale-110 transition-transform duration-200`}>
            <item.icon size={18} className={item.color} strokeWidth={1.5} />
          </div>
          <span className="text-sm font-medium text-zinc-300 block">{item.label}</span>
          <span className="text-2xs text-zinc-600 block mt-0.5">{item.desc}</span>
          {item.free && <span className="badge-free text-2xs mt-2 mx-auto">FREE</span>}
        </Link>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   LEADERBOARD
   ═══════════════════════════════════════════ */
function AgentLeaderboard() {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const badgeMap = { 0: 'SAFE', 1: 'MEDIUM', 2: 'RISKY' };

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const res = await fetch('/api/agents/leaderboard');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setLeaders(data.map((a, i) => ({ rank: i + 1, agentId: a.agentId, name: a.name, score: a.score, badge: badgeMap[a.badge] ?? 'SAFE' })));
        }
      } catch {}
      setLoading(false);
    }
    fetchLeaderboard();
  }, []);

  const badgeClass = { SAFE: 'badge-safe', MEDIUM: 'badge-medium', RISKY: 'badge-risky' };
  const scoreColor = (s) => s >= 70 ? 'text-emerald-400' : s >= 40 ? 'text-amber-400' : 'text-red-400';
  const rankBg = (r) => r === 1 ? 'bg-accent/15 text-accent' : r <= 3 ? 'bg-primary/10 text-primary-light' : 'bg-zinc-800 text-zinc-600';

  const rankColors = {
    1: 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-[0_0_8px_rgba(245,158,11,0.3)]',
    2: 'bg-gradient-to-br from-zinc-300 to-zinc-400 text-zinc-800',
    3: 'bg-gradient-to-br from-amber-700 to-amber-800 text-amber-200',
  };

  return (
    <div className="card animate-fade-in-up" style={{ animationDelay: '150ms' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2"><Trophy size={14} className="text-accent" /><h3 className="section-title">Agent Leaderboard</h3></div>
        <span className="text-2xs text-zinc-600 bg-zinc-800/60 rounded-md px-2 py-0.5 font-medium">Top Agents</span>
      </div>
      <div className="space-y-0.5">
        {loading && Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3 px-2">
            <div className="flex items-center gap-3"><div className="w-7 h-7 rounded-lg bg-zinc-800 animate-pulse" /><div className="h-3.5 w-28 bg-zinc-800 rounded-lg animate-pulse" /></div>
            <div className="h-3.5 w-16 bg-zinc-800 rounded-lg animate-pulse" />
          </div>
        ))}
        {!loading && leaders.length === 0 && (
          <div className="text-center py-10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent/15 to-accent/5 flex items-center justify-center mx-auto mb-4">
              <Crown size={24} className="text-accent/60" />
            </div>
            <p className="text-zinc-400 text-sm font-semibold mb-1">No agents ranked yet</p>
            <p className="text-zinc-600 text-xs mb-4">Deploy the first agent and claim the top spot</p>
            <Link to="/create-agent" className="text-xs text-primary-light font-medium bg-primary/10 hover:bg-primary/15 rounded-lg px-4 py-2 border border-primary/15 transition-colors inline-flex items-center gap-1.5">
              Create Agent <ArrowRight size={11} />
            </Link>
          </div>
        )}
        {!loading && leaders.map((agent) => (
          <Link
            key={agent.rank}
            to={`/agent/${agent.agentId || agent.rank}`}
            className="flex items-center justify-between py-2.5 px-2.5 rounded-xl hover:bg-zinc-800/50 transition-all group"
          >
            <div className="flex items-center gap-3">
              {rankColors[agent.rank] ? (
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-2xs font-extrabold ${rankColors[agent.rank]}`}>{agent.rank}</span>
              ) : (
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-2xs font-bold ${rankBg(agent.rank)}`}>{agent.rank}</span>
              )}
              <div>
                <span className="text-sm text-zinc-300 font-medium group-hover:text-white transition-colors block leading-tight">{agent.name}</span>
                <span className={`${badgeClass[agent.badge]} scale-90 origin-left inline-block mt-0.5`}>{agent.badge}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <ScoreRing score={agent.score} size={32} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   LIVE EVENT FEED
   ═══════════════════════════════════════════ */
function LiveEventFeed() {
  const { events: wsEvents } = useWebSocket();

  function formatTimeAgo(ts) {
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  function mapEvent(ev, index) {
    const id = ev.id || index;
    const ago = ev.timestamp ? formatTimeAgo(ev.timestamp) : 'just now';
    switch (ev.type) {
      case 'AgentExecuted': return { id, type: ev.action === 'predict' || ev.action === 'prediction' ? 'PREDICT' : 'SQUAD', message: `${ev.agentName || 'Agent'} executed ${ev.action || 'action'}`, time: ago };
      case 'AgentViolation': return { id, type: 'BLOCKED', message: `${ev.agentName || 'Agent'}: ${ev.reason || 'violation'}`, time: ago };
      case 'SquadJoined': return { id, type: 'SQUAD', message: `${ev.agentName || 'Agent'} joined ${ev.contestName || 'contest'}`, time: ago };
      case 'PredictionResolved': return { id, type: 'PREDICT', message: `${ev.agentName || 'Agent'} prediction resolved`, time: ago };
      case 'NFTMinted': return { id, type: 'NFT', message: `${ev.agentName || 'Agent'} minted "${ev.nftName || 'NFT'}"`, time: ago };
      default: return { id, type: 'SQUAD', message: ev.message || `${ev.type || 'Event'} received`, time: ago };
    }
  }

  const events = wsEvents.slice(0, 10).map(mapEvent);
  const typeConfig = {
    SQUAD: { dot: 'bg-secondary' }, PREDICT: { dot: 'bg-primary-light' },
    NFT: { dot: 'bg-accent' }, BLOCKED: { dot: 'bg-red-400' },
  };

  return (
    <div className="card animate-fade-in-up" style={{ animationDelay: '250ms' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2"><Activity size={14} className="text-emerald-400" /><h3 className="section-title">Live Activity</h3></div>
        {events.length > 0 && (
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /><span className="text-2xs text-zinc-600">Real-time</span></span>
        )}
      </div>
      <div className="space-y-0.5">
        {events.length === 0 && (
          <div className="text-center py-8">
            <div className="w-10 h-10 rounded-xl bg-zinc-800/60 flex items-center justify-center mx-auto mb-2.5">
              <Activity size={18} className="text-zinc-700" />
            </div>
            <p className="text-zinc-600 text-xs">Activity will appear here in real-time</p>
          </div>
        )}
        {events.map((event) => {
          const config = typeConfig[event.type] || typeConfig.SQUAD;
          return (
            <div key={event.id} className="flex items-start gap-3 text-sm py-2 px-2 rounded-lg hover:bg-zinc-800/30 transition-colors">
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${config.dot}`} />
              <span className="text-zinc-500 flex-1 text-xs leading-relaxed">{event.message}</span>
              <span className="text-zinc-700 shrink-0 text-2xs tabular-nums">{event.time}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   CTA BANNER (Bottom of landing)
   ═══════════════════════════════════════════ */
function CTABanner() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-secondary/10" />
      <div className="absolute top-0 left-1/4 w-48 h-48 bg-primary/10 rounded-full blur-[60px]" />
      <div className="relative px-6 py-8 text-center">
        <h3 className="text-lg font-bold text-white mb-2">Join thousands of PSL fans on WireTrust</h3>
        <p className="text-sm text-zinc-400 mb-5 max-w-md mx-auto">
          Connect your wallet and start playing in under 60 seconds. 1,000 free credits on testnet.
        </p>
        <Link to="/welcome" className="btn-primary text-sm py-3 px-8 inline-flex items-center gap-2 shadow-glow-sm">
          <Zap size={16} />
          Get Started Free
        </Link>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN DASHBOARD
   ═══════════════════════════════════════════ */
export default function Dashboard() {
  const { connected, address, ready } = useWallet();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const walletState = useSelector((s) => s.wallet);
  const [stats, setStats] = useState({ totalAgents: '-', totalPredictions: '-', totalNFTs: '-', activeContests: '-' });
  const [myAgents, setMyAgents] = useState([]);
  const [agentsLoading, setAgentsLoading] = useState(false);

  // Preload Redux stores on dashboard mount (main entry point)
  useEffect(() => {
    dispatch(fetchMatches());
    dispatch(fetchContests());
  }, [dispatch]);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          setStats({ totalAgents: data.totalAgents ?? 0, totalPredictions: data.totalPredictions ?? 0, totalNFTs: data.totalNFTs ?? 0, activeContests: data.activeContests ?? 0 });
        }
      } catch {}
    }
    fetchStats();
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!connected || !address) { setMyAgents([]); return; }
    setAgentsLoading(true);
    fetch(`/api/agents/owner/${address}`)
      .then(r => r.json())
      .then(async (ids) => {
        const agentIds = Array.isArray(ids) ? ids : [];
        if (agentIds.length === 0) { setMyAgents([]); setAgentsLoading(false); return; }
        const details = await Promise.allSettled(agentIds.map(id => fetch(`/api/agents/${id}`).then(r => r.json())));
        setMyAgents(details.filter(r => r.status === 'fulfilled').map(r => ({
          id: r.value.agent?.id, name: r.value.agent?.name, botType: r.value.agent?.botType,
          active: r.value.agent?.active, score: Number(r.value.reputation?.score ?? 50), badge: r.value.reputation?.badge ?? 1,
        })));
        setAgentsLoading(false);
      })
      .catch(() => { setMyAgents([]); setAgentsLoading(false); });
  }, [connected, address, ready]);

  // Redirect to home if not connected
  useEffect(() => {
    if (ready && !connected) navigate('/', { replace: true });
  }, [connected, ready, navigate]);

  if (!connected) return null;

  /* ── Connected: Operational dashboard ── */
  return (
    <div className="animate-fade-in space-y-5">
      <LiveMatchBanner />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
        <div className="lg:col-span-2 space-y-5">
          <StatsBar stats={stats} />
          <MyAgentsSection agents={myAgents} loading={agentsLoading} />
          <QuickActions />
          <PageGuide
            id="dashboard"
            title="Getting Started"
            steps={[
              { icon: Monitor, title: 'Deploy an AI Agent', desc: 'Create an autonomous AI agent with 8 on-chain policy checks per action. It predicts matches and builds squads on its own.' },
              { icon: Users, title: 'Join a Squad Challenge', desc: 'Pick 11 players within 100 credits. Set your captain (2x points) and vice-captain (1.5x points). Completely free.' },
              { icon: Target, title: 'Predict Match Outcomes', desc: 'Who wins? Top scorer? Over or under on total runs? Earn points for correct calls and build streaks for bonus rewards.' },
              { icon: Award, title: 'Claim NFT Rewards', desc: 'Complete on-chain challenges to earn match tickets, player cards, VIP experiences and achievement badges.' },
            ]}
            tips={[
              'All activity is recorded on WireFluid. Every score, prediction and transfer is transparent.',
              'Squad challenges and predictions are always free. No entry fees, no staking.',
              'Your fan reputation is permanent. Correct predictions and challenge completions build your profile.',
            ]}
          />
        </div>
        <div className="space-y-5">
          <AgentLeaderboard />
          <LiveEventFeed />
        </div>
      </div>
    </div>
  );
}
