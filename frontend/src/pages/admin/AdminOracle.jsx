import { useState, useEffect, useMemo } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { Radio, Send, CheckCircle2, AlertTriangle, ChevronDown } from 'lucide-react';

const H = (addr) => ({ 'x-wallet-address': addr || '', 'Content-Type': 'application/json' });

export default function AdminOracle() {
  const { address } = useWallet();
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [resultForm, setResultForm] = useState({ match_id: '', winner: '', abandoned: false });
  const [statForm, setStatForm] = useState({ match_id: '', player_id: '', runs: 0, wickets: 0, economy: 0, strike_rate: 0, is_motm: false });
  const [liveForm, setLiveForm] = useState({ match_id: '', team1: '', team2: '', innings: 1, overs: '0.0', score: '0/0', batting: '', bowling: '', current_batsman: '', current_bowler: '', run_rate: '0.00' });
  const [msg, setMsg] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/matches?limit=1000', { headers: H(address) }).then(r => r.json()),
      fetch('/api/admin/players?limit=1000', { headers: H(address) }).then(r => r.json()),
    ]).then(([m, p]) => { setMatches(m.rows || m || []); setPlayers(p.rows || p || []); }).catch(() => {});
  }, [address]);

  // Players for the selected match (both teams)
  const matchPlayers = useMemo(() => {
    if (!selectedMatch) return [];
    return players.filter(p => p.active && (p.team === selectedMatch.team1 || p.team === selectedMatch.team2));
  }, [selectedMatch, players]);

  // Group match players by team
  const team1Players = matchPlayers.filter(p => p.team === selectedMatch?.team1);
  const team2Players = matchPlayers.filter(p => p.team === selectedMatch?.team2);

  function selectMatch(mid) {
    const m = matches.find(x => x.match_id === Number(mid));
    if (m) {
      setSelectedMatch(m);
      setResultForm(f => ({ ...f, match_id: m.match_id, winner: m.team1 }));
      setStatForm(f => ({ ...f, match_id: m.match_id, player_id: '' }));
      setLiveForm(f => ({ ...f, match_id: m.match_id, team1: m.team1, team2: m.team2, batting: m.team1, bowling: m.team2 }));
    } else {
      setSelectedMatch(null);
    }
  }

  async function submitResult(e) {
    e.preventDefault();
    setSubmitting(true); setMsg(null);
    try {
      const res = await fetch('/api/admin/oracle/submit-result', { method: 'POST', headers: H(address), body: JSON.stringify(resultForm) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({ type: 'success', text: `Result submitted! Tx: ${data.txHash?.slice(0, 14)}...` });
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
    setSubmitting(false);
  }

  async function submitStats(e) {
    e.preventDefault();
    setSubmitting(true); setMsg(null);
    try {
      const res = await fetch('/api/admin/oracle/submit-player-stats', { method: 'POST', headers: H(address), body: JSON.stringify(statForm) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const pName = players.find(p => p.player_id === Number(statForm.player_id))?.name || statForm.player_id;
      setMsg({ type: 'success', text: `Stats submitted for ${pName}! Tx: ${data.txHash?.slice(0, 14)}...` });
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
    setSubmitting(false);
  }

  async function updateLive(e) {
    e.preventDefault();
    setSubmitting(true); setMsg(null);
    try {
      const res = await fetch('/api/admin/live-match', { method: 'POST', headers: H(address), body: JSON.stringify(liveForm) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({ type: 'success', text: 'Live match state updated!' });
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
    setSubmitting(false);
  }

  const TABS = ['Match Result', 'Player Stats', 'Live State'];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Radio size={22} className="text-amber-400" /> Oracle Management</h1>
        <p className="text-sm text-zinc-500 mt-1">Submit match results, player stats and update live state</p>
      </div>

      {msg && (
        <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${msg.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-400/5 border border-red-400/20 text-red-400'}`}>
          {msg.type === 'success' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          {msg.text}
        </div>
      )}

      {/* Match selector */}
      <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5">
        <label className="text-2xs text-zinc-500 uppercase font-medium block mb-2">Select Match</label>
        <select onChange={e => selectMatch(e.target.value)} className="input" defaultValue="">
          <option value="">Choose a match...</option>
          {matches.map(m => (
            <option key={m.match_id} value={m.match_id}>
              #{m.match_id} - {m.team1} vs {m.team2} ({m.status}) - {m.start_time ? new Date(m.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBD'}
            </option>
          ))}
        </select>
        {selectedMatch && (
          <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
            <span className="text-white font-medium">{selectedMatch.team1} vs {selectedMatch.team2}</span>
            <span>{selectedMatch.venue}</span>
            <span className={`px-2 py-0.5 rounded-full text-2xs font-medium ${selectedMatch.status === 'LIVE' ? 'bg-emerald-500/10 text-emerald-400' : selectedMatch.status === 'COMPLETED' ? 'bg-zinc-700/30 text-zinc-400' : 'bg-blue-500/10 text-blue-400'}`}>{selectedMatch.status}</span>
            <span>{matchPlayers.length} players available</span>
          </div>
        )}
      </div>

      {!selectedMatch ? (
        <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-12 text-center text-zinc-500 text-sm">
          Select a match above to manage oracle data
        </div>
      ) : (
        <>
          {/* Tab navigation */}
          <div className="flex gap-1 bg-zinc-900/50 rounded-xl p-1">
            {TABS.map((t, i) => (
              <button key={t} onClick={() => setTab(i)}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === i ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>
                {t}
              </button>
            ))}
          </div>

          {/* Tab: Submit Result */}
          {tab === 0 && (
            <form onSubmit={submitResult} className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Radio size={14} className="text-emerald-400" /> Submit Match Result
                <span className="text-2xs text-zinc-600 font-normal ml-2">On-Chain Transaction</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Match</label>
                  <div className="input bg-zinc-800/50 text-zinc-400 cursor-not-allowed">#{resultForm.match_id} - {selectedMatch.team1} vs {selectedMatch.team2}</div>
                </div>
                <div>
                  <label className="form-label">Winner</label>
                  <select value={resultForm.winner} onChange={e => setResultForm(f => ({ ...f, winner: e.target.value }))} required className="input" disabled={resultForm.abandoned}>
                    <option value={selectedMatch.team1}>{selectedMatch.team1}</option>
                    <option value={selectedMatch.team2}>{selectedMatch.team2}</option>
                    <option value="TIE">TIE</option>
                    <option value="NO_RESULT">NO RESULT</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer px-3 py-2.5 rounded-lg bg-zinc-800/40 hover:bg-zinc-800/60 transition-colors w-full">
                    <input type="checkbox" checked={resultForm.abandoned} onChange={e => setResultForm(f => ({ ...f, abandoned: e.target.checked, winner: e.target.checked ? 'NO_RESULT' : selectedMatch.team1 }))} className="rounded accent-red-500" />
                    <span>Match Abandoned</span>
                  </label>
                </div>
              </div>
              <button type="submit" disabled={submitting} className="btn-primary text-sm flex items-center gap-1.5">
                <Send size={14} /> {submitting ? 'Submitting to chain...' : 'Submit Result On-Chain'}
              </button>
            </form>
          )}

          {/* Tab: Player Stats */}
          {tab === 1 && (
            <form onSubmit={submitStats} className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Radio size={14} className="text-blue-400" /> Submit Player Stats
                <span className="text-2xs text-zinc-600 font-normal ml-2">On-Chain Transaction</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                <div className="sm:col-span-2">
                  <label className="form-label">Player</label>
                  <select value={statForm.player_id} onChange={e => setStatForm(f => ({ ...f, player_id: Number(e.target.value) }))} required className="input">
                    <option value="">Select player...</option>
                    <optgroup label={selectedMatch.team1}>
                      {team1Players.map(p => <option key={p.player_id} value={p.player_id}>{p.name} ({p.role})</option>)}
                    </optgroup>
                    <optgroup label={selectedMatch.team2}>
                      {team2Players.map(p => <option key={p.player_id} value={p.player_id}>{p.name} ({p.role})</option>)}
                    </optgroup>
                  </select>
                </div>
                <div>
                  <label className="form-label">Runs Scored</label>
                  <input type="number" min="0" value={statForm.runs} onChange={e => setStatForm(f => ({ ...f, runs: Number(e.target.value) }))} className="input" />
                </div>
                <div>
                  <label className="form-label">Wickets Taken</label>
                  <input type="number" min="0" max="10" value={statForm.wickets} onChange={e => setStatForm(f => ({ ...f, wickets: Number(e.target.value) }))} className="input" />
                </div>
                <div>
                  <label className="form-label">Economy Rate (x100)</label>
                  <input type="number" min="0" value={statForm.economy} onChange={e => setStatForm(f => ({ ...f, economy: Number(e.target.value) }))} className="input" placeholder="725 = 7.25" />
                </div>
                <div>
                  <label className="form-label">Strike Rate (x100)</label>
                  <input type="number" min="0" value={statForm.strike_rate} onChange={e => setStatForm(f => ({ ...f, strike_rate: Number(e.target.value) }))} className="input" placeholder="14250 = 142.50" />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer px-3 py-2.5 rounded-lg bg-zinc-800/40 hover:bg-zinc-800/60 transition-colors w-full">
                    <input type="checkbox" checked={statForm.is_motm} onChange={e => setStatForm(f => ({ ...f, is_motm: e.target.checked }))} className="rounded accent-amber-500" />
                    <span>Man of the Match</span>
                  </label>
                </div>
              </div>
              <button type="submit" disabled={submitting || !statForm.player_id} className="btn-primary text-sm flex items-center gap-1.5">
                <Send size={14} /> {submitting ? 'Submitting to chain...' : 'Submit Stats On-Chain'}
              </button>
            </form>
          )}

          {/* Tab: Live State */}
          {tab === 2 && (
            <form onSubmit={updateLive} className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Radio size={14} className="text-amber-400" /> Update Live Match State
                <span className="text-2xs text-zinc-600 font-normal ml-2">Database Update</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                <div>
                  <label className="form-label">Innings</label>
                  <select value={liveForm.innings} onChange={e => setLiveForm(f => ({ ...f, innings: Number(e.target.value) }))} className="input">
                    <option value={1}>1st Innings</option>
                    <option value={2}>2nd Innings</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Batting Team</label>
                  <select value={liveForm.batting} onChange={e => setLiveForm(f => ({ ...f, batting: e.target.value, bowling: e.target.value === selectedMatch.team1 ? selectedMatch.team2 : selectedMatch.team1 }))} className="input">
                    <option value={selectedMatch.team1}>{selectedMatch.team1}</option>
                    <option value={selectedMatch.team2}>{selectedMatch.team2}</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Score</label>
                  <input value={liveForm.score} onChange={e => setLiveForm(f => ({ ...f, score: e.target.value }))} className="input" placeholder="98/2" />
                </div>
                <div>
                  <label className="form-label">Overs</label>
                  <input value={liveForm.overs} onChange={e => setLiveForm(f => ({ ...f, overs: e.target.value }))} className="input" placeholder="12.3" />
                </div>
                <div>
                  <label className="form-label">Current Batsman</label>
                  <select value={liveForm.current_batsman} onChange={e => setLiveForm(f => ({ ...f, current_batsman: e.target.value }))} className="input">
                    <option value="">Select...</option>
                    {(liveForm.batting === selectedMatch.team1 ? team1Players : team2Players).map(p => (
                      <option key={p.player_id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Current Bowler</label>
                  <select value={liveForm.current_bowler} onChange={e => setLiveForm(f => ({ ...f, current_bowler: e.target.value }))} className="input">
                    <option value="">Select...</option>
                    {(liveForm.bowling === selectedMatch.team1 ? team1Players : team2Players).filter(p => p.role === 'BOWL' || p.role === 'ALL').map(p => (
                      <option key={p.player_id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Run Rate</label>
                  <input value={liveForm.run_rate} onChange={e => setLiveForm(f => ({ ...f, run_rate: e.target.value }))} className="input" placeholder="7.84" />
                </div>
              </div>

              {/* Live preview */}
              <div className="bg-zinc-800/40 rounded-xl p-4 border border-zinc-700/30">
                <div className="text-2xs text-zinc-500 uppercase font-medium mb-2">Live Preview</div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-bold">{liveForm.batting || '-'}</div>
                    <div className="text-2xl font-bold text-accent">{liveForm.score || '0/0'} <span className="text-sm text-zinc-500">({liveForm.overs || '0.0'} ov)</span></div>
                  </div>
                  <div className="text-right text-xs text-zinc-500">
                    <div>CRR: {liveForm.run_rate || '0.00'}</div>
                    <div>{liveForm.current_batsman || '-'} batting</div>
                    <div>{liveForm.current_bowler || '-'} bowling</div>
                  </div>
                </div>
              </div>

              <button type="submit" disabled={submitting} className="btn-primary text-sm flex items-center gap-1.5">
                <Send size={14} /> {submitting ? 'Updating...' : 'Update Live State'}
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
