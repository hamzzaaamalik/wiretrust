import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useWallet } from '../../contexts/WalletContext';
import {
  Bot, Eye, Brain, BarChart3, Shield, Target, Users, TrendingUp, TrendingDown,
  Minus, AlertCircle, CheckCircle, Flame, MapPin, Swords, Zap, Trophy,
  Activity, ChevronRight, Cpu, GitBranch, Play, Square, Plus, Clock, XCircle
} from 'lucide-react';

const H = (addr) => ({ 'x-wallet-address': addr || '', 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/json' });

function TrendIcon({ trend }) {
  if (trend === 'rising' || trend === 'improving') return <TrendingUp size={12} className="text-emerald-400" />;
  if (trend === 'declining') return <TrendingDown size={12} className="text-red-400" />;
  return <Minus size={12} className="text-zinc-500" />;
}

function StatusBadge({ status }) {
  const styles = {
    BREAKOUT: 'bg-emerald-500/15 text-emerald-300', COLLAPSE: 'bg-red-500/15 text-red-300',
    ABOVE_AVG: 'bg-emerald-500/10 text-emerald-400', BELOW_AVG: 'bg-amber-500/10 text-amber-400',
    PEAKING: 'bg-emerald-500/10 text-emerald-400', DECLINING: 'bg-red-500/10 text-red-400',
    NORMAL: 'bg-zinc-800 text-zinc-500', STEADY: 'bg-zinc-800 text-zinc-500',
  };
  return <span className={`text-2xs font-medium px-1.5 py-0.5 rounded ${styles[status] || styles.NORMAL}`}>{status}</span>;
}

function ThreatBadge({ level }) {
  const s = { HIGH: 'bg-red-500/10 text-red-400', MEDIUM: 'bg-amber-500/10 text-amber-400', LOW: 'bg-emerald-500/10 text-emerald-400' };
  return <span className={`text-2xs font-bold px-2 py-0.5 rounded ${s[level] || s.MEDIUM}`}>{level}</span>;
}

function SeverityDot({ severity }) {
  const colors = { error: 'bg-red-400', warning: 'bg-amber-400', success: 'bg-emerald-400', info: 'bg-zinc-500' };
  return <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors[severity] || colors.info}`} />;
}

const TABS = [
  { id: 'agents', label: 'My Agents', icon: Bot },
  { id: 'scouting', label: 'Match Prediction', icon: Brain },
  { id: 'form', label: 'Player Intelligence', icon: Activity },
  { id: 'squad', label: 'Squad Optimizer', icon: Cpu },
  { id: 'opponents', label: 'Opponent Watch', icon: Swords },
];

const AGENT_ICONS = { SCOUT: Eye, FORM_MONITOR: Activity, MATCH_PREP: Brain };

export default function FranchiseAgents() {
  const { address } = useWallet();
  const { franchise } = useOutletContext();
  const [tab, setTab] = useState('agents');
  const [intel, setIntel] = useState(null);
  const [runningAgents, setRunningAgents] = useState([]);
  const [agentTypes, setAgentTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    if (!address) return;
    const headers = { 'x-wallet-address': address };

    Promise.all([
      fetch('/api/franchise-portal/agents/intelligence', { headers }).then(r => r.json()).catch(() => null),
      fetch('/api/franchise-portal/agents/running', { headers }).then(r => r.json()).catch(() => []),
      fetch('/api/franchise-portal/agents/types', { headers }).then(r => r.json()).catch(() => []),
    ]).then(([intelData, running, types]) => {
      if (intelData && !intelData.error) setIntel(intelData);
      setRunningAgents(Array.isArray(running) ? running : []);
      setAgentTypes(Array.isArray(types) ? types : []);
      setLoading(false);
    });
  }, [address]);

  useEffect(() => { loadData(); }, [loadData]);

  // Single polling loop: refresh running agents when on agents tab
  useEffect(() => {
    if (tab !== 'agents' || !address) return;
    const interval = setInterval(() => {
      fetch('/api/franchise-portal/agents/running', { headers: { 'x-wallet-address': address } })
        .then(r => r.json())
        .then(data => { if (Array.isArray(data)) setRunningAgents(data); })
        .catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [tab, address]);

  function refreshAgents() {
    fetch('/api/franchise-portal/agents/running', { headers: { 'x-wallet-address': address } })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setRunningAgents(data); })
      .catch(() => {});
  }

  async function startAgent(type) {
    const res = await fetch('/api/franchise-portal/agents/start', {
      method: 'POST', headers: H(address),
      body: JSON.stringify({ type }),
    });
    const result = await res.json();
    console.log('Agent started:', result);
    // Quick refresh of running list (don't reload intel - it's slow)
    setTimeout(refreshAgents, 500);
    setTimeout(refreshAgents, 2000);
    setTimeout(refreshAgents, 5000);
  }

  async function stopAgent(agentId) {
    await fetch(`/api/franchise-portal/agents/${agentId}/stop`, {
      method: 'POST', headers: H(address),
    });
    setTimeout(refreshAgents, 500);
  }

  if (loading) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div><h1 className="text-2xl font-bold text-white flex items-center gap-2"><Bot size={22} className="text-violet-400" /> AI Agents</h1></div>
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-32 bg-zinc-900/70 rounded-2xl animate-pulse" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Bot size={22} className="text-violet-400" /> AI Agents</h1>
          <p className="text-sm text-zinc-500 mt-1">Deploy and manage ML-powered agents for {franchise?.name || 'your franchise'}</p>
        </div>
        {intel?.ml?.matchPrediction?.modelStats && !intel.ml.matchPrediction.modelStats.fallback && (
          <div className="hidden sm:flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-lg px-3 py-1.5">
            <GitBranch size={12} className="text-violet-400" />
            <span className="text-2xs text-violet-300">RF Model: {intel.ml.matchPrediction.modelStats.samples} samples, {intel.ml.matchPrediction.modelStats.accuracy}% acc</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all shrink-0 ${
              tab === t.id ? 'bg-violet-500/15 text-violet-300 border border-violet-500/20' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
            }`}>
            <t.icon size={13} /><span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'agents' && <AgentsTab types={agentTypes} running={runningAgents} onStart={startAgent} onStop={stopAgent} address={address} />}
      {tab === 'scouting' && <ScoutingTab data={intel} />}
      {tab === 'form' && <FormTab data={intel} />}
      {tab === 'squad' && <SquadTab data={intel} />}
      {tab === 'opponents' && <OpponentTab data={intel} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 0: AGENT MANAGEMENT
// ═══════════════════════════════════════════════════════════════
function AgentsTab({ types, running, onStart, onStop, address }) {
  const [agentStatuses, setAgentStatuses] = useState({});

  // Poll agent statuses every 10 seconds for live updates
  useEffect(() => {
    if (running.length === 0) return;
    function poll() {
      Promise.all(running.map(a =>
        fetch(`/api/franchise-portal/agents/${a.agentId}/status`, { headers: { 'x-wallet-address': address } })
          .then(r => r.json()).catch(() => null)
      )).then(statuses => {
        const map = {};
        running.forEach((a, i) => { if (statuses[i]) map[a.agentId] = statuses[i]; });
        setAgentStatuses(map);
      });
    }
    poll(); // immediate
    const interval = setInterval(poll, 10000); // every 10s
    return () => clearInterval(interval);
  }, [running, address]);

  return (
    <div className="space-y-5">
      {/* Deploy New Agent */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Plus size={14} className="text-violet-400" /> Deploy Agent</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {types.map(t => {
            const isRunning = running.some(a => a.type === t.id);
            const Icon = AGENT_ICONS[t.id] || Bot;
            return (
              <div key={t.id} className={`bg-zinc-900/70 border rounded-xl p-4 ${isRunning ? 'border-emerald-500/30' : 'border-zinc-800/80'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                    <Icon size={16} className="text-violet-400" />
                  </div>
                  {isRunning && <span className="flex items-center gap-1 text-2xs text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Running</span>}
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">{t.name}</h3>
                <p className="text-2xs text-zinc-500 leading-relaxed mb-3">{t.description}</p>
                {isRunning ? (
                  <button onClick={() => { const a = running.find(a => a.type === t.id); if (a) onStop(a.agentId); }}
                    className="w-full flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                    <Square size={10} /> Stop Agent
                  </button>
                ) : (
                  <button onClick={() => onStart(t.id)}
                    className="w-full flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                    <Play size={10} /> Deploy & Start
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Running Agents + Activity Feeds */}
      {running.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2"><Activity size={14} className="text-emerald-400" /> Agent Activity</h2>
          {running.map(agent => {
            const status = agentStatuses[agent.agentId];
            const reports = status?.reports || [];
            const Icon = AGENT_ICONS[agent.type] || Bot;
            return (
              <div key={agent.agentId} className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-zinc-800/40 flex items-center gap-3">
                  <Icon size={16} className="text-violet-400" />
                  <span className="text-sm font-semibold text-white flex-1">{agent.typeName || agent.type}</span>
                  <span className="flex items-center gap-1.5 text-2xs text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live</span>
                  <span className="text-2xs text-zinc-600">{reports.length} reports</span>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {reports.length === 0 ? (
                    <div className="px-5 py-6 text-center text-zinc-600 text-xs">Agent is running... first report coming soon</div>
                  ) : (
                    <div className="divide-y divide-zinc-800/30">
                      {reports.slice(0, 15).map((r, i) => (
                        <div key={i} className="px-5 py-2.5 flex items-start gap-2.5 hover:bg-zinc-800/20">
                          <SeverityDot severity={r.severity} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-zinc-300 leading-relaxed">{r.title}</p>
                            {r.data?.message && <p className="text-2xs text-zinc-600 mt-0.5">{r.data.message}</p>}
                            {r.data?.teams && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {r.data.teams.map((t, j) => (
                                  <span key={j} className="text-2xs bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">{t.team} ({t.elo})</span>
                                ))}
                              </div>
                            )}
                            {r.data?.tacticalNotes && (
                              <div className="mt-1 space-y-0.5">
                                {r.data.tacticalNotes.slice(0, 2).map((n, j) => (
                                  <p key={j} className="text-2xs text-zinc-500 leading-relaxed">{n}</p>
                                ))}
                              </div>
                            )}
                          </div>
                          <span className="text-2xs text-zinc-700 shrink-0">{new Date(r.timestamp).toLocaleTimeString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {running.length === 0 && (
        <div className="bg-zinc-900/50 border border-zinc-800/40 rounded-xl p-6 text-center">
          <Bot size={32} className="text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">No agents running. Deploy a Scout, Form Monitor, or Match Prep agent above.</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 1: MATCH PREDICTION
// ═══════════════════════════════════════════════════════════════
function ScoutingTab({ data }) {
  const report = data?.scouting;
  const ml = data?.ml?.matchPrediction;
  if (!report) return <Empty text="No upcoming match found for scouting analysis." />;
  const myProb = ml?.probability?.[report.myTeam] || report.confidence;

  return (
    <div className="space-y-4">
      <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-white">{report.myTeam} vs {report.opponent}</h2>
            {report.venue && <p className="text-2xs text-zinc-500 mt-0.5">{report.venue}</p>}
          </div>
          <div className="text-right">
            <div className={`text-4xl font-bold tabular-nums ${myProb >= 55 ? 'text-emerald-400' : myProb >= 45 ? 'text-amber-400' : 'text-red-400'}`}>{myProb}%</div>
            <p className="text-2xs text-zinc-500">{ml && !ml.modelStats?.fallback ? 'Random Forest ML' : 'Statistical'}</p>
          </div>
        </div>
        {ml?.featureValues && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[
              { label: 'ELO', value: ml.featureValues.eloDiff, icon: Zap, color: 'text-violet-400' },
              { label: 'Form', value: ml.featureValues.formDiff, icon: TrendingUp, color: 'text-emerald-400' },
              { label: 'H2H', value: ml.featureValues.h2hWinRate, icon: Swords, color: 'text-blue-400' },
              { label: 'Momentum', value: ml.featureValues.momentumDiff, icon: Flame, color: 'text-red-400' },
              { label: 'Venue', value: ml.featureValues.venueWinRate, icon: MapPin, color: 'text-amber-400' },
              { label: 'Role', value: ml.featureValues.roleFormDiff, icon: Users, color: 'text-purple-400' },
            ].map(f => (
              <div key={f.label} className="bg-zinc-800/40 rounded-lg p-2.5 text-center">
                <f.icon size={12} className={`${f.color} mx-auto mb-1`} />
                <div className="text-xs font-bold text-white">{f.value}</div>
                <div className="text-2xs text-zinc-600">{f.label}</div>
              </div>
            ))}
          </div>
        )}
        {report.topThreats?.length > 0 && (
          <div className="border-t border-zinc-800/40 pt-3 mt-4">
            <h3 className="text-xs font-semibold text-zinc-400 mb-2"><AlertCircle size={12} className="text-red-400 inline mr-1" />Key Threats</h3>
            {report.topThreats.slice(0, 4).map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-xs py-1">
                <span className="text-zinc-600 w-3">#{i+1}</span>
                <span className="text-white font-medium flex-1">{p.name}</span>
                <span className="text-zinc-500">{p.role}</span>
                <span className="text-emerald-400 font-bold w-8 text-right">{p.ewma?.toFixed(1)}</span>
                <TrendIcon trend={p.trend} />
              </div>
            ))}
          </div>
        )}
      </div>
      {report.tacticalNotes?.length > 0 && (
        <div className="bg-violet-500/5 border border-violet-500/15 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-violet-300 mb-3"><Brain size={14} className="inline mr-1" />AI Analysis</h3>
          {report.tacticalNotes.map((n, i) => (
            <div key={i} className="flex items-start gap-2 mb-1.5">
              <ChevronRight size={12} className="text-violet-400 mt-0.5 shrink-0" />
              <p className="text-xs text-zinc-400 leading-relaxed">{n}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 2: PLAYER INTELLIGENCE
// ═══════════════════════════════════════════════════════════════
function FormTab({ data }) {
  const forecasts = data?.ml?.playerForecasts || [];
  const anomalies = data?.ml?.anomalies;
  if (forecasts.length === 0) return <Empty text="No player data available." />;

  return (
    <div className="space-y-4">
      {anomalies && (anomalies.summary.breakouts > 0 || anomalies.summary.collapses > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {anomalies.breakouts.map((p, i) => (
            <div key={`b${i}`} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
              <TrendingUp size={14} className="text-emerald-400" />
              <p className="text-xs text-zinc-300 flex-1"><span className="font-semibold text-emerald-400">{p.name}</span> BREAKOUT (z={p.zScore})</p>
            </div>
          ))}
          {anomalies.collapses.map((p, i) => (
            <div key={`c${i}`} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-red-500/5 border border-red-500/15">
              <TrendingDown size={14} className="text-red-400" />
              <p className="text-xs text-zinc-300 flex-1"><span className="font-semibold text-red-400">{p.name}</span> COLLAPSE (z={p.zScore})</p>
            </div>
          ))}
        </div>
      )}
      <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-500 text-left border-b border-zinc-800">
              <th className="px-4 py-2.5 text-2xs font-medium">#</th>
              <th className="px-3 py-2.5 text-2xs font-medium">Player</th>
              <th className="px-3 py-2.5 text-2xs font-medium">Role</th>
              <th className="px-3 py-2.5 text-2xs font-medium text-right">Current</th>
              <th className="px-3 py-2.5 text-2xs font-medium text-right">Predicted</th>
              <th className="px-3 py-2.5 text-2xs font-medium text-right">Range</th>
              <th className="px-3 py-2.5 text-2xs font-medium text-right">R²</th>
              <th className="px-3 py-2.5 text-2xs font-medium text-right">Alert</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/40">
            {forecasts.slice(0, 20).map((p, i) => {
              const a = anomalies?.players?.find(x => x.playerId === p.playerId);
              return (
                <tr key={i} className={`hover:bg-zinc-800/30 ${a?.alert === 'BREAKOUT' ? 'border-l-2 border-l-emerald-500' : a?.alert === 'COLLAPSE' ? 'border-l-2 border-l-red-500' : ''}`}>
                  <td className="px-4 py-2 text-zinc-600 text-xs">{i+1}</td>
                  <td className="px-3 py-2 text-white font-medium text-xs">{p.name}</td>
                  <td className="px-3 py-2 text-zinc-400 text-2xs">{p.role}</td>
                  <td className="px-3 py-2 text-right text-zinc-400 text-xs tabular-nums">{p.currentForm > 0 ? p.currentForm.toFixed(1) : '-'}</td>
                  <td className="px-3 py-2 text-right text-emerald-400 font-bold text-xs tabular-nums">{p.forecast?.predicted > 0 ? p.forecast.predicted : '-'}</td>
                  <td className="px-3 py-2 text-right text-zinc-500 text-2xs tabular-nums">{p.forecast?.range ? `${p.forecast.range.low}-${p.forecast.range.high}` : '-'}</td>
                  <td className="px-3 py-2 text-right text-zinc-500 text-2xs">{p.forecast?.rSquared > 0 ? p.forecast.rSquared : '-'}</td>
                  <td className="px-3 py-2 text-right">{a ? <StatusBadge status={a.alert} /> : <span className="text-2xs text-zinc-700">-</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 3: SQUAD OPTIMIZER
// ═══════════════════════════════════════════════════════════════
function SquadTab({ data }) {
  const squad = data?.ml?.optimizedSquad;
  if (!squad) return <Empty text="Need player data to optimize squad." />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Players', value: squad.squad.length, color: 'text-white' },
          { label: 'Credits', value: `${squad.totalCredits}/${squad.budget}`, color: 'text-violet-400' },
          { label: 'Predicted FP', value: squad.totalPredicted, color: 'text-emerald-400' },
          { label: 'With C/VC', value: squad.adjustedTotal, color: 'text-accent' },
        ].map(s => (
          <div key={s.label} className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-2xs text-zinc-500">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-6 h-6 rounded-full bg-accent text-zinc-950 flex items-center justify-center text-xs font-bold">C</span>
            <span className="text-sm font-bold text-white">{squad.captain.name}</span>
          </div>
          <p className="text-2xs text-zinc-500">Predicted: {squad.captain.predicted} FP (2x = {Math.round(squad.captain.predicted * 2)})</p>
        </div>
        <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">V</span>
            <span className="text-sm font-bold text-white">{squad.viceCaptain.name}</span>
          </div>
          <p className="text-2xs text-zinc-500">Predicted: {squad.viceCaptain.predicted} FP (1.5x = {Math.round(squad.viceCaptain.predicted * 1.5)})</p>
        </div>
      </div>
      <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-zinc-500 text-left border-b border-zinc-800">
            <th className="px-4 py-2.5 text-2xs font-medium">#</th>
            <th className="px-3 py-2.5 text-2xs font-medium">Player</th>
            <th className="px-3 py-2.5 text-2xs font-medium">Role</th>
            <th className="px-3 py-2.5 text-2xs font-medium text-right">Credits</th>
            <th className="px-3 py-2.5 text-2xs font-medium text-right">Predicted</th>
          </tr></thead>
          <tbody className="divide-y divide-zinc-800/40">
            {squad.squad.map((p, i) => (
              <tr key={i} className="hover:bg-zinc-800/30">
                <td className="px-4 py-2 text-zinc-600 text-xs">{i+1}</td>
                <td className="px-3 py-2 text-xs">
                  <span className="text-white font-medium">{p.name}</span>
                  {p.isCaptain && <span className="ml-1 w-4 h-4 inline-flex items-center justify-center rounded-full bg-accent text-zinc-950 text-2xs font-bold">C</span>}
                  {p.isViceCaptain && <span className="ml-1 w-4 h-4 inline-flex items-center justify-center rounded-full bg-blue-500 text-white text-2xs font-bold">V</span>}
                </td>
                <td className="px-3 py-2 text-zinc-400 text-2xs">{p.role}</td>
                <td className="px-3 py-2 text-right text-violet-400 font-bold text-xs">{p.credits}</td>
                <td className="px-3 py-2 text-right text-emerald-400 font-bold text-xs">{p.predicted > 0 ? p.predicted : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 4: OPPONENT WATCH
// ═══════════════════════════════════════════════════════════════
function OpponentTab({ data }) {
  const opponents = data?.opponentWatch?.opponents;
  if (!opponents?.length) return <Empty text="No opponent data available." />;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {opponents.map(opp => (
        <div key={opp.team} className={`bg-zinc-900/70 border rounded-2xl p-5 ${opp.threatLevel === 'HIGH' ? 'border-red-500/20' : opp.threatLevel === 'MEDIUM' ? 'border-amber-500/20' : 'border-zinc-800/80'}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white">{opp.team}</h3>
            <ThreatBadge level={opp.threatLevel} />
          </div>
          <div className="flex items-center gap-4 mb-3">
            <div><div className="text-xs text-violet-400 font-bold">{opp.elo}</div><div className="text-2xs text-zinc-600">ELO</div></div>
            <div><div className={`text-xs font-bold ${opp.momentum >= 60 ? 'text-emerald-400' : opp.momentum <= 40 ? 'text-red-400' : 'text-zinc-300'}`}>{opp.momentum}/100</div><div className="text-2xs text-zinc-600">Mom</div></div>
            <div><div className="text-xs text-white font-bold">{opp.record.wins}W-{opp.record.losses}L</div><div className="text-2xs text-zinc-600">{opp.record.winRate}%</div></div>
          </div>
          {opp.lastResults?.length > 0 && (
            <div className="flex items-center gap-1 mb-2">
              {opp.lastResults.map((r, i) => (
                <span key={i} className={`w-5 h-5 rounded text-center text-2xs font-bold leading-5 ${r === 'W' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{r}</span>
              ))}
            </div>
          )}
          {opp.topPlayers?.length > 0 && (
            <div className="border-t border-zinc-800/40 pt-2 space-y-1">
              {opp.topPlayers.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-2xs">
                  <span className="text-zinc-400">{p.name} ({p.role})</span>
                  <span className="text-emerald-400 font-bold">{p.ewma?.toFixed(1)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Empty({ text }) {
  return <div className="bg-zinc-900/70 rounded-2xl p-12 text-center text-zinc-500 text-sm">{text}</div>;
}
