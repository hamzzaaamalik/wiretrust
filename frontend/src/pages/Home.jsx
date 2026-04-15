import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import {
  Monitor, TrendingUp, Image, Users, Zap, ArrowRight, ChevronRight,
  Trophy, Activity, Flame, Target, Sparkles, Shield, Gift,
  Gamepad2, BookOpen, CheckCircle2, Wallet, Star, Award, Lock,
  Cpu, Eye, BarChart3, Crown, Globe, Heart
} from 'lucide-react';

/* ═══════════════════════════════════════════
   ANIMATED COUNTER
   ═══════════════════════════════════════════ */
function AnimatedNum({ target, suffix = '' }) {
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
          const progress = Math.min((now - start) / 1200, 1);
          setCount(Math.round((1 - Math.pow(1 - progress, 3)) * num));
          if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
      }
    }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return <span ref={ref}>{count}{suffix}</span>;
}

/* ═══════════════════════════════════════════
   SCROLLING TICKER
   ═══════════════════════════════════════════ */
function Ticker() {
  const items = [
    { text: 'Babar Azam smashes 78 off 55 balls', color: 'text-emerald-400' },
    { text: '5,000 WIRE sponsor pool live on Pindiz vs Karachi', color: 'text-secondary' },
    { text: 'Shaheen Afridi Player Card minted', color: 'text-accent' },
    { text: '72% of fans predict Pindiz to win Match 1', color: 'text-primary-light' },
    { text: 'New challenge: Predict 3 matches for Oracle badge', color: 'text-accent' },
    { text: 'VIP Match Day Experience now claimable', color: 'text-secondary' },
  ];

  return (
    <div className="relative overflow-hidden py-2.5 border-y border-zinc-800/40">
      <div className="flex animate-scroll-x">
        {[...items, ...items].map((item, i) => (
          <div key={i} className="flex items-center gap-3 shrink-0 px-5">
            <span className={`w-1 h-1 rounded-full ${item.color.replace('text-', 'bg-')}`} />
            <span className={`text-xs font-medium whitespace-nowrap ${item.color}`}>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   HOME PAGE
   ═══════════════════════════════════════════ */
export default function Home() {
  const { connected } = useWallet();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalAgents: 0, totalPredictions: 0, totalNFTs: 0, activeContests: 0 });

  useEffect(() => {
    if (connected) navigate('/dashboard', { replace: true });
  }, [connected, navigate]);

  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(d => {
      setStats({ totalAgents: d.totalAgents ?? 0, totalPredictions: d.totalPredictions ?? 0, totalNFTs: d.totalNFTs ?? 0, activeContests: d.activeContests ?? 0 });
    }).catch(() => {});
  }, []);

  if (connected) return null;

  return (
    <div className="animate-fade-in space-y-0">
      <Ticker />

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden rounded-3xl border border-zinc-800/40 mt-6">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.15] via-dark-bg to-secondary/[0.10]" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] -translate-y-1/3 translate-x-1/4 animate-pulse-glow" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-secondary/8 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4" />
        <div className="absolute inset-0 grid-pattern opacity-30" />

        <div className="relative px-6 sm:px-10 lg:px-14 py-14 sm:py-20 flex flex-col lg:flex-row items-center gap-10">
          <div className="flex-1 max-w-xl">
            <div className="inline-flex items-center gap-2 bg-zinc-800/60 backdrop-blur-sm border border-zinc-700/40 rounded-full px-3.5 py-1.5 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
              <span className="text-2xs font-medium text-zinc-400">Live on WireFluid Testnet</span>
              <span className="text-2xs text-zinc-600">|</span>
              <span className="text-2xs font-medium text-secondary">Chain 92533</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-[1.15] mb-5">
              Cricket Fan Economy,{' '}
              <span className="text-gradient">On-Chain</span>
              <span className="text-zinc-600">.</span>
            </h1>

            <p className="text-zinc-400 text-base sm:text-lg leading-relaxed mb-8 max-w-lg">
              Predict matches, build dream squads, deploy AI agents and earn NFT rewards. Every action is policy-enforced, every achievement is permanent.
              <span className="text-zinc-300 font-medium"> Free to play. Halal compliant.</span>
            </p>

            <div className="flex flex-wrap gap-3 mb-8">
              <Link to="/welcome" className="btn-primary text-sm py-3 px-7 flex items-center gap-2.5 shadow-glow-sm">
                <Zap size={16} /> Start Playing Free
              </Link>
              <Link to="/learn" className="btn-secondary text-sm py-3 px-7 flex items-center gap-2.5">
                <BookOpen size={16} /> How It Works
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-5">
              {[
                { icon: Shield, label: 'Halal Compliant', color: 'text-secondary' },
                { icon: Gift, label: 'Free to Play', color: 'text-accent' },
                { icon: CheckCircle2, label: 'On-Chain Verified', color: 'text-primary-light' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <item.icon size={13} className={item.color} />
                  <span className="text-xs text-zinc-500 font-medium">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Floating preview cards */}
          <div className="relative w-72 h-64 shrink-0 hidden lg:block">
            <div className="absolute top-0 left-0 w-48 bg-zinc-900/90 backdrop-blur-xl border border-zinc-700/50 rounded-2xl p-4 shadow-float animate-float">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center"><Monitor size={16} className="text-primary-light" /></div>
                <div><p className="text-xs font-semibold text-white">Pindiz-Agent-Alpha</p><p className="text-2xs text-zinc-500">SQUAD Agent</p></div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5"><div className="w-6 h-6 rounded-md bg-emerald-500/15 flex items-center justify-center"><span className="text-2xs font-bold text-emerald-400">75</span></div><span className="text-2xs text-emerald-400 font-medium">SAFE</span></div>
              </div>
            </div>
            <div className="absolute top-16 right-0 w-44 bg-zinc-900/90 backdrop-blur-xl border border-zinc-700/50 rounded-2xl p-3.5 shadow-float animate-float" style={{ animationDelay: '1.5s' }}>
              <div className="flex items-center gap-2 mb-2"><Target size={14} className="text-primary-light" /><span className="text-2xs font-semibold text-white">Prediction</span><span className="badge-free text-2xs ml-auto">FREE</span></div>
              <p className="text-2xs text-zinc-400">Pindiz to win</p>
              <div className="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full w-[68%] bg-gradient-to-r from-primary to-secondary rounded-full" /></div>
              <p className="text-2xs text-zinc-600 mt-1">68% community pick</p>
            </div>
            <div className="absolute bottom-0 left-6 w-40 bg-zinc-900/90 backdrop-blur-xl border border-accent/20 rounded-2xl p-3 shadow-float animate-float" style={{ animationDelay: '0.8s' }}>
              <div className="w-full h-16 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center mb-2"><Star size={20} className="text-accent" /></div>
              <p className="text-2xs font-semibold text-white">Babar Azam Gold</p>
              <p className="text-2xs text-accent">Soulbound Badge</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ WHAT YOU CAN DO ═══ */}
      <section className="py-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Four Ways to Play</h2>
          <p className="text-sm text-zinc-500">Everything is free. No staking, no entry fees, no gambling.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: Gamepad2, title: 'Squad Challenge', desc: 'Pick 11 players within 100 credits. Assign captain (2x points) and vice-captain (1.5x). Compete for sponsor-funded prizes.', to: '/welcome', color: 'from-secondary/20 to-secondary/5', iconColor: 'text-secondary', badge: 'FREE TO PLAY' },
            { icon: Target, title: 'Match Predictions', desc: 'Call the match winner, top scorer or total runs. Earn points for correct calls. Build streaks for bonus rewards and soulbound badges.', to: '/welcome', color: 'from-accent/20 to-accent/5', iconColor: 'text-accent', badge: 'EARN POINTS' },
            { icon: Sparkles, title: 'NFT Rewards', desc: 'Complete challenges to earn match tickets, player collectibles, VIP experiences and achievement badges. All on-chain, all verifiable.', to: '/welcome', color: 'from-amber-500/20 to-amber-500/5', iconColor: 'text-amber-400', badge: 'EARN REWARDS' },
            { icon: Monitor, title: 'AI Agents', desc: 'Unlock after reaching fan milestones. Deploy your own AI agent that predicts matches and builds squads using 6-factor intelligence.', to: '/welcome', color: 'from-primary/20 to-primary/5', iconColor: 'text-primary-light', badge: 'UNLOCK VIA ACHIEVEMENTS' },
          ].map((f, i) => (
            <Link key={f.title} to={f.to} className="group relative overflow-hidden card-interactive p-0 animate-fade-in-up" style={{ animationDelay: `${i * 80}ms` }}>
              <div className={`absolute inset-0 bg-gradient-to-br ${f.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              <div className="relative p-5">
                <div className="flex items-start justify-between mb-3.5">
                  <div className="w-11 h-11 rounded-xl bg-zinc-800/80 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <f.icon size={20} className={f.iconColor} strokeWidth={1.5} />
                  </div>
                  <span className="badge-free text-2xs">{f.badge}</span>
                </div>
                <h3 className="text-sm font-semibold text-white mb-1.5">{f.title}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed mb-3 group-hover:text-zinc-400 transition-colors">{f.desc}</p>
                <div className="flex items-center gap-1 text-xs text-zinc-600 group-hover:text-primary-light transition-colors">
                  <span>Get Started</span><ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="py-12 border-t border-zinc-800/40">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Start in Under 2 Minutes</h2>
          <p className="text-sm text-zinc-500">No crypto knowledge required. Sign in with Google.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { num: '01', title: 'Connect', desc: 'Sign in with Google or MetaMask. Receive free WIRE credits on testnet instantly. No downloads, no extensions needed.', icon: Wallet, color: 'from-primary/20 to-primary/5', iconColor: 'text-primary-light' },
            { num: '02', title: 'Play', desc: 'Predict match outcomes, build your dream XI, or deploy an AI agent. Every action is free and recorded on-chain.', icon: Gamepad2, color: 'from-secondary/20 to-secondary/5', iconColor: 'text-secondary' },
            { num: '03', title: 'Earn', desc: 'Correct predictions earn points. Squad challenges win prizes. Complete challenges for NFT tickets, badges and collectibles.', icon: Trophy, color: 'from-accent/20 to-accent/5', iconColor: 'text-accent' },
          ].map((step, i) => (
            <div key={step.num} className="relative group card-surface hover:border-zinc-700/60 transition-all duration-300 overflow-hidden">
              <div className={`absolute inset-0 bg-gradient-to-br ${step.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              <div className="relative">
                <span className="text-3xl font-black text-zinc-800/80 absolute -top-1 -right-1 select-none">{step.num}</span>
                <div className="w-11 h-11 rounded-xl bg-zinc-800/80 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <step.icon size={20} className={step.iconColor} strokeWidth={1.5} />
                </div>
                <h3 className="text-sm font-semibold text-white mb-1.5">{step.title}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed group-hover:text-zinc-400 transition-colors">{step.desc}</p>
              </div>
              {i < 2 && <div className="hidden sm:block absolute top-1/2 -right-2 w-4 h-px bg-zinc-800 z-10" />}
            </div>
          ))}
        </div>
      </section>

      {/* ═══ 6-FACTOR INTELLIGENCE ═══ */}
      <section className="py-12 border-t border-zinc-800/40">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">6-Factor Cricket Intelligence</h2>
          <p className="text-sm text-zinc-500">Our AI agents use pure-math analysis, not guesswork.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'ELO Ratings', weight: '25%', icon: BarChart3, desc: 'Self-learning team power rankings', color: 'text-primary-light', bg: 'bg-primary/10' },
            { label: 'EWMA Form', weight: '20%', icon: TrendingUp, desc: 'Exponential player form tracking', color: 'text-secondary', bg: 'bg-secondary/10' },
            { label: 'Head-to-Head', weight: '15%', icon: Users, desc: 'Historical matchup dominance', color: 'text-accent', bg: 'bg-accent/10' },
            { label: 'Momentum', weight: '15%', icon: Flame, desc: 'Win streaks and trajectory', color: 'text-red-400', bg: 'bg-red-500/10' },
            { label: 'Venue Stats', weight: '15%', icon: Globe, desc: 'Ground-specific performance', color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { label: 'Role-Weighted', weight: '10%', icon: Crown, desc: 'Batting vs bowling split', color: 'text-amber-400', bg: 'bg-amber-400/10' },
          ].map((f) => (
            <div key={f.label} className="card-surface text-center py-5 hover:border-zinc-700/60 transition-all">
              <div className={`w-10 h-10 rounded-xl ${f.bg} flex items-center justify-center mx-auto mb-3`}>
                <f.icon size={18} className={f.color} strokeWidth={1.5} />
              </div>
              <p className="text-sm font-semibold text-white">{f.label}</p>
              <p className="text-lg font-bold text-gradient mb-1">{f.weight}</p>
              <p className="text-2xs text-zinc-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ PROTOCOL STATS ═══ */}
      <section className="py-12 border-t border-zinc-800/40">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Live Protocol Stats</h2>
          <p className="text-sm text-zinc-500">Real on-chain data from WireFluid testnet</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { key: 'totalAgents', label: 'Agents Deployed', icon: Monitor, color: 'text-primary-light', border: 'border-primary/20' },
            { key: 'totalPredictions', label: 'Predictions Made', icon: Target, color: 'text-secondary', border: 'border-secondary/20' },
            { key: 'totalNFTs', label: 'NFTs Minted', icon: Sparkles, color: 'text-accent', border: 'border-accent/20' },
            { key: 'activeContests', label: 'Live Contests', icon: Flame, color: 'text-red-400', border: 'border-red-500/20' },
          ].map((item) => (
            <div key={item.key} className={`card-surface text-center py-6 ${item.border}`}>
              <div className="w-10 h-10 rounded-xl bg-zinc-800/60 flex items-center justify-center mx-auto mb-3">
                <item.icon size={18} className={item.color} strokeWidth={1.5} />
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums"><AnimatedNum target={stats[item.key]} /></p>
              <p className="text-xs text-zinc-500 mt-1 font-medium">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ SECURITY & TRUST ═══ */}
      <section className="py-12 border-t border-zinc-800/40">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Built for Trust</h2>
          <p className="text-sm text-zinc-500">9 smart contracts. 203 passing tests. Every action verifiable on-chain.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: Lock, title: 'Policy-Enforced', desc: 'Every agent action passes through 8 on-chain policy checks. Spending limits, frequency caps, whitelisted contracts, max positions.', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            { icon: Eye, title: 'Transparent', desc: 'All predictions, squad entries, scores and NFT transfers are recorded on WireFluid. Nothing hidden, everything auditable.', color: 'text-primary-light', bg: 'bg-primary/10' },
            { icon: Heart, title: 'Halal Compliant', desc: 'Points-only predictions. Sponsor-funded prizes. No staking, no wagering, no gambling mechanics. Free to play, always.', color: 'text-red-400', bg: 'bg-red-500/10' },
          ].map((f) => (
            <div key={f.title} className="card-surface">
              <div className={`w-11 h-11 rounded-xl ${f.bg} flex items-center justify-center mb-4`}>
                <f.icon size={20} className={f.color} strokeWidth={1.5} />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1.5">{f.title}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ PSL TEAMS ═══ */}
      <section className="py-12 border-t border-zinc-800/40">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">PSL 2026</h2>
          <p className="text-sm text-zinc-500">6 franchise teams. 157 players. 44 matches seeded on-chain.</p>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            { name: 'Islamabad United', short: 'IU', color: 'from-red-600/20 to-red-600/5', text: 'text-red-400' },
            { name: 'Karachi Kings', short: 'KK', color: 'from-blue-600/20 to-blue-600/5', text: 'text-blue-400' },
            { name: 'Lahore Qalandars', short: 'LQ', color: 'from-emerald-600/20 to-emerald-600/5', text: 'text-emerald-400' },
            { name: 'Multan Sultans', short: 'MS', color: 'from-yellow-600/20 to-yellow-600/5', text: 'text-yellow-400' },
            { name: 'Peshawar Zalmi', short: 'PZ', color: 'from-amber-600/20 to-amber-600/5', text: 'text-amber-400' },
            { name: 'Quetta Gladiators', short: 'QG', color: 'from-purple-600/20 to-purple-600/5', text: 'text-purple-400' },
          ].map((team) => (
            <div key={team.short} className={`card-surface text-center py-5 bg-gradient-to-br ${team.color} hover:scale-105 transition-transform`}>
              <p className={`text-2xl font-bold ${team.text} mb-1`}>{team.short}</p>
              <p className="text-2xs text-zinc-500 font-medium">{team.name}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="py-12 border-t border-zinc-800/40">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Common Questions</h2>
        </div>
        <div className="max-w-2xl mx-auto space-y-3">
          {[
            { q: 'Is it really free?', a: 'Yes. Predictions are points-only. Squad challenge prizes are funded by sponsors. You never pay to play.' },
            { q: 'Do I need a crypto wallet?', a: 'No. You can sign in with Google. We create a wallet for you behind the scenes using Web3Auth.' },
            { q: 'Is this gambling?', a: 'No. This is a points-based fan engagement platform. No staking, no wagering, no money at risk. Fully halal compliant.' },
            { q: 'What are AI Agents?', a: 'Autonomous bots that analyze matches and make predictions on your behalf. They are governed by 8 on-chain policy checks and earn reputation based on performance.' },
            { q: 'What blockchain is this on?', a: 'WireFluid (Chain ID: 92533). An EVM-compatible chain. All contracts are deployed and verifiable on-chain.' },
          ].map((faq, i) => (
            <details key={i} className="group card-surface cursor-pointer">
              <summary className="flex items-center justify-between text-sm font-semibold text-zinc-300 list-none">
                {faq.q}
                <ChevronRight size={14} className="text-zinc-600 group-open:rotate-90 transition-transform" />
              </summary>
              <p className="text-xs text-zinc-500 leading-relaxed mt-2 pt-2 border-t border-zinc-800/40">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ═══ FOR FRANCHISES ═══ */}
      <section className="py-12 border-t border-zinc-800/40">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">For Franchises</h2>
          <p className="text-sm text-zinc-500">Manage your team with AI-powered tools and on-chain governance.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: Monitor, title: 'AI Agents', desc: 'Deploy autonomous AI agents to analyze player form, scout opponents, optimize contest creation and predict match outcomes using 6-factor intelligence.', color: 'text-primary-light', bg: 'bg-primary/10' },
            { icon: Shield, title: 'Policy Governance', desc: 'Every agent action passes through 8 on-chain policy checks. Spending limits, frequency caps, whitelisted contracts, full audit trail.', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            { icon: BarChart3, title: 'Analytics Dashboard', desc: 'Player performance tracking, EWMA form analysis, head-to-head records, venue stats, team momentum scoring and fan engagement metrics.', color: 'text-accent', bg: 'bg-accent/10' },
          ].map((f) => (
            <div key={f.title} className="card-surface">
              <div className={`w-11 h-11 rounded-xl ${f.bg} flex items-center justify-center mb-4`}>
                <f.icon size={20} className={f.color} strokeWidth={1.5} />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1.5">{f.title}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="py-12 border-t border-zinc-800/40">
        <div className="relative overflow-hidden rounded-2xl border border-primary/20">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-secondary/10" />
          <div className="absolute top-0 left-1/4 w-48 h-48 bg-primary/10 rounded-full blur-[60px]" />
          <div className="relative px-6 py-10 text-center">
            <h3 className="text-xl font-bold text-white mb-2">Join PSL fans on WireTrust</h3>
            <p className="text-sm text-zinc-400 mb-6 max-w-md mx-auto">
              Connect and start playing in under 60 seconds. Free credits on testnet.
            </p>
            <Link to="/welcome" className="btn-primary text-sm py-3 px-8 inline-flex items-center gap-2 shadow-glow-sm">
              <Zap size={16} /> Get Started Free
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
