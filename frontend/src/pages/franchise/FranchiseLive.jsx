import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useWallet } from '../../contexts/WalletContext';
import { Radio, Send, CheckCircle2, AlertTriangle, Users2 } from 'lucide-react';

const H = (addr) => ({ 'x-wallet-address': addr || '', 'Content-Type': 'application/json' });
const API = '/api/franchise-portal';

export default function FranchiseLive() {
  const { address } = useWallet();
  const { franchise } = useOutletContext();
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [liveForm, setLiveForm] = useState({
    match_id: '', team1: '', team2: '', innings: 1, overs: '0.0', score: '0/0',
    batting: '', bowling: '', current_batsman: '', current_bowler: '', run_rate: '0.00',
  });
  const [msg, setMsg] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [matchPlayers, setMatchPlayers] = useState([]);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/matches?limit=1000`, { headers: H(address) }).then(r => r.json()),
      fetch(`${API}/players?limit=1000`, { headers: H(address) }).then(r => r.json()),
    ]).then(([m, p]) => { setMatches(m.rows || m || []); setPlayers(p.rows || p || []); }).catch(() => {});
  }, [address]);

  const team1Players = useMemo(() => {
    if (!selectedMatch) return [];
    return players.filter(p => p.active !== false && p.team === selectedMatch.team1);
  }, [selectedMatch, players]);

  const team2Players = useMemo(() => {
    if (!selectedMatch) return [];
    return players.filter(p => p.active !== false && p.team === selectedMatch.team2);
  }, [selectedMatch, players]);

  function selectMatch(mid) {
    const m = matches.find(x => x.match_id === Number(mid));
    if (m) {
      setSelectedMatch(m);
      setLiveForm(f => ({
        ...f, match_id: m.match_id, team1: m.team1, team2: m.team2,
        batting: m.team1, bowling: m.team2,
      }));
    } else {
      setSelectedMatch(null);
    }
  }

  async function updateLive(e) {
    e.preventDefault();
    setSubmitting(true); setMsg(null);
    try {
      const res = await fetch(`${API}/live-match`, { method: 'POST', headers: H(address), body: JSON.stringify(liveForm) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({ type: 'success', text: 'Live match state updated!' });
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
    setSubmitting(false);
  }

  // Quick score buttons
  function addRuns(runs) {
    const [r, w] = (liveForm.score || '0/0').split('/').map(Number);
    setLiveForm(f => ({ ...f, score: `${r + runs}/${w}` }));
  }
  function addWicket() {
    const [r, w] = (liveForm.score || '0/0').split('/').map(Number);
    setLiveForm(f => ({ ...f, score: `${r}/${w + 1}` }));
  }
  function incrementOvers() {
    const [o, b] = (liveForm.overs || '0.0').split('.').map(Number);
    const newBall = (b || 0) + 1;
    const newOvers = newBall >= 6 ? `${o + 1}.0` : `${o}.${newBall}`;
    setLiveForm(f => ({ ...f, overs: newOvers }));
  }

  // Only show UPCOMING or LIVE matches for live control
  const liveMatches = matches.filter(m => m.status === 'UPCOMING' || m.status === 'LIVE');

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Radio size={22} className="text-amber-400" /> Live Match Control
        </h1>
        <p className="text-sm text-zinc-500 mt-1">Update live match scores and state in real-time</p>
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
          {liveMatches.map(m => (
            <option key={m.match_id} value={m.match_id}>
              #{m.match_id} - {m.team1} vs {m.team2} ({m.status}) - {m.start_time ? new Date(m.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBD'}
            </option>
          ))}
        </select>
        {selectedMatch && (
          <div className="mt-3 flex items-center gap-4 text-xs text-zinc-500">
            <span className="text-white font-medium">{selectedMatch.team1} vs {selectedMatch.team2}</span>
            {selectedMatch.venue && <span>{selectedMatch.venue}</span>}
            <span className={`px-2 py-0.5 rounded-full text-2xs font-medium ${selectedMatch.status === 'LIVE' ? 'bg-emerald-500/10 text-emerald-400 animate-pulse' : 'bg-blue-500/10 text-blue-400'}`}>{selectedMatch.status}</span>
            <span className="flex items-center gap-1"><Users2 size={10} /> {team1Players.length + team2Players.length} players</span>
          </div>
        )}
      </div>

      {!selectedMatch ? (
        <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-12 text-center text-zinc-500 text-sm">
          {liveMatches.length === 0
            ? 'No upcoming or live matches. Create a match first.'
            : 'Select a match above to control live state'}
        </div>
      ) : (
        <form onSubmit={updateLive} className="space-y-4">
          {/* Live Preview Card */}
          <div className="bg-gradient-to-r from-emerald-500/10 via-zinc-900/70 to-zinc-900/70 border border-emerald-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-2xs text-emerald-400 uppercase font-bold tracking-wider">Live Preview</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-zinc-400">{liveForm.innings === 1 ? '1st' : '2nd'} Innings</div>
                <div className="text-lg font-bold text-white mt-1">{liveForm.batting || '-'}</div>
                <div className="text-3xl font-bold text-accent mt-1">
                  {liveForm.score || '0/0'}
                  <span className="text-sm text-zinc-500 ml-2">({liveForm.overs || '0.0'} ov)</span>
                </div>
              </div>
              <div className="text-right space-y-1">
                <div className="text-xs text-zinc-500">CRR: <span className="text-white font-medium">{liveForm.run_rate || '0.00'}</span></div>
                <div className="text-xs text-zinc-500">Batting: <span className="text-white">{liveForm.current_batsman || '-'}</span></div>
                <div className="text-xs text-zinc-500">Bowling: <span className="text-white">{liveForm.current_bowler || '-'}</span></div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5">
            <div className="text-2xs text-zinc-500 uppercase font-medium mb-3">Quick Score</div>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 6].map(r => (
                <button key={r} type="button" onClick={() => addRuns(r)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-sm transition-colors">
                  +{r}
                </button>
              ))}
              <button type="button" onClick={addWicket}
                className="px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-sm border border-red-500/20 transition-colors">
                W
              </button>
              <button type="button" onClick={incrementOvers}
                className="px-4 py-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-bold text-sm border border-blue-500/20 transition-colors">
                +1 Ball
              </button>
              <button type="button" onClick={() => addRuns(0)}
                className="px-4 py-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-400 font-bold text-sm transition-colors">
                Dot
              </button>
            </div>
          </div>

          {/* Detailed Controls */}
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5 space-y-4">
            <div className="text-2xs text-zinc-500 uppercase font-medium">Match State</div>
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
                <select value={liveForm.batting} onChange={e => setLiveForm(f => ({
                  ...f, batting: e.target.value,
                  bowling: e.target.value === selectedMatch.team1 ? selectedMatch.team2 : selectedMatch.team1,
                }))} className="input">
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
                  {(liveForm.bowling === selectedMatch.team1 ? team1Players : team2Players)
                    .filter(p => p.role === 'BOWL' || p.role === 'ALL')
                    .map(p => (
                      <option key={p.player_id} value={p.name}>{p.name}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="form-label">Run Rate</label>
                <input value={liveForm.run_rate} onChange={e => setLiveForm(f => ({ ...f, run_rate: e.target.value }))} className="input" placeholder="7.84" />
              </div>
            </div>
          </div>

          <button type="submit" disabled={submitting} className="btn-primary text-sm flex items-center gap-1.5 w-full justify-center py-3">
            <Send size={14} /> {submitting ? 'Updating...' : 'Push Live Update'}
          </button>
        </form>
      )}
    </div>
  );
}
