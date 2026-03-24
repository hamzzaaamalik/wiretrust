import { useState, useEffect } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { Calendar, Plus, Trash2, Edit3, Save, MapPin, Clock } from 'lucide-react';

const H = (addr) => ({ 'x-wallet-address': addr || '', 'Content-Type': 'application/json' });
const STATUSES = ['UPCOMING', 'LIVE', 'COMPLETED', 'ABANDONED'];
const STATUS_COLORS = {
  UPCOMING: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  LIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 animate-pulse',
  COMPLETED: 'bg-zinc-700/30 text-zinc-400 border-zinc-700/30',
  ABANDONED: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const VENUES = [
  'Rawalpindi Cricket Stadium',
  'Gaddafi Stadium, Lahore',
  'National Bank Stadium, Karachi',
  'Multan Cricket Stadium',
  'Iqbal Stadium, Faisalabad',
  'Arbab Niaz Stadium, Peshawar',
];

export default function AdminMatches() {
  const { address } = useWallet();
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ match_id: '', franchise_id: 1, team1: '', team2: '', venue: '', start_time: '', status: 'UPCOMING' });
  const [msg, setMsg] = useState(null);
  const [filter, setFilter] = useState('ALL');

  // Derive unique teams from players in DB
  const teams = [...new Set(players.filter(p => p.active).map(p => p.team))].sort();

  async function load() {
    try {
      const [mr, pr] = await Promise.all([
        fetch(`/api/admin/matches?limit=500`, { headers: H(address) }).then(r => r.json()),
        fetch('/api/admin/players?limit=500', { headers: H(address) }).then(r => r.json()),
      ]);
      setMatches(Array.isArray(mr) ? mr : (mr.rows || []));
      setPlayers(Array.isArray(pr) ? pr : (pr.rows || []));
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, [address]);

  function startEdit(m) {
    setForm({
      match_id: m.match_id,
      franchise_id: m.franchise_id,
      team1: m.team1,
      team2: m.team2,
      venue: m.venue || '',
      start_time: m.start_time ? new Date(m.start_time).toISOString().slice(0, 16) : '',
      status: m.status,
    });
    setEditing(m.match_id);
    setShowForm(true);
    setMsg(null);
  }

  function startNew() {
    const nextId = matches.length > 0 ? Math.max(...matches.map(m => m.match_id)) + 1 : 1;
    setForm({ match_id: nextId, franchise_id: 1, team1: teams[0] || '', team2: teams[1] || '', venue: VENUES[0], start_time: '', status: 'UPCOMING' });
    setEditing(null);
    setShowForm(true);
    setMsg(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg(null);
    if (form.team1 === form.team2) { setMsg({ type: 'error', text: 'Team 1 and Team 2 cannot be the same' }); return; }
    try {
      const res = await fetch('/api/admin/matches', {
        method: 'POST', headers: H(address),
        body: JSON.stringify({ ...form, start_time: form.start_time ? new Date(form.start_time).toISOString() : null }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setMsg({ type: 'success', text: editing ? `Match #${form.match_id} updated!` : `Match #${form.match_id} created!` });
      setShowForm(false);
      setEditing(null);
      await load();
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  }

  async function handleDelete(matchId) {
    if (!confirm(`Delete match #${matchId}? This cannot be undone.`)) return;
    try {
      await fetch(`/api/admin/matches/${matchId}`, { method: 'DELETE', headers: H(address) });
      setMsg({ type: 'success', text: `Match #${matchId} deleted` });
      await load();
    } catch {}
  }

  const filtered = filter === 'ALL' ? matches : matches.filter(m => m.status === filter);
  const counts = {};
  STATUSES.forEach(s => { counts[s] = matches.filter(m => m.status === s).length; });

  if (loading) return <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-zinc-900/70 rounded-2xl animate-pulse" />)}</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Calendar size={22} className="text-blue-400" /> Match Schedule</h1>
          <p className="text-sm text-zinc-500 mt-1">{matches.length} matches &middot; {counts.UPCOMING || 0} upcoming &middot; {counts.LIVE || 0} live</p>
        </div>
        <button onClick={startNew} className="btn-primary text-sm flex items-center gap-1.5"><Plus size={14} /> Add Match</button>
      </div>

      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm ${msg.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-400/5 border border-red-400/20 text-red-400'}`}>{msg.text}</div>
      )}

      {/* Status filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {['ALL', ...STATUSES].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filter === s ? 'bg-zinc-700 text-white' : 'bg-zinc-900/50 text-zinc-500 hover:text-zinc-300'}`}>
            {s} {s === 'ALL' ? `(${matches.length})` : `(${counts[s] || 0})`}
          </button>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-6 space-y-4 animate-fade-in">
          <h3 className="text-sm font-semibold text-white">{editing ? `Edit Match #${editing}` : 'New Match'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="form-label">Match ID</label>
              <input type="number" value={form.match_id} onChange={e => setForm(f => ({ ...f, match_id: Number(e.target.value) }))} required className="input" disabled={!!editing} />
            </div>
            <div>
              <label className="form-label">Team 1 (Home)</label>
              <select value={form.team1} onChange={e => setForm(f => ({ ...f, team1: e.target.value }))} required className="input">
                <option value="">Select team...</option>
                {teams.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Team 2 (Away)</label>
              <select value={form.team2} onChange={e => setForm(f => ({ ...f, team2: e.target.value }))} required className="input">
                <option value="">Select team...</option>
                {teams.filter(t => t !== form.team1).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Venue</label>
              <select value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} className="input">
                <option value="">Select venue...</option>
                {VENUES.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Start Time</label>
              <input type="datetime-local" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className="input [color-scheme:dark]" />
            </div>
            <div>
              <label className="form-label">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="input">
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          {form.team1 && form.team2 && form.team1 === form.team2 && (
            <div className="text-red-400 text-xs">Teams cannot be the same</div>
          )}
          <div className="flex gap-3">
            <button type="submit" disabled={form.team1 === form.team2} className="btn-primary text-sm flex items-center gap-1.5"><Save size={14} /> {editing ? 'Update Match' : 'Create Match'}</button>
            <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="btn-secondary text-sm">Cancel</button>
          </div>
        </form>
      )}

      {/* Match list */}
      {filtered.length === 0 ? (
        <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-12 text-center text-zinc-500 text-sm">
          {filter === 'ALL' ? 'No matches created yet' : `No ${filter.toLowerCase()} matches`}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(m => (
            <div key={m.match_id} className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-4 hover:border-zinc-700/60 transition-all">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 shrink-0">#{m.match_id}</div>
                  <div className="min-w-0">
                    <div className="font-medium text-white text-sm">{m.team1} <span className="text-zinc-600 font-normal">vs</span> {m.team2}</div>
                    <div className="flex items-center gap-3 text-2xs text-zinc-500 mt-1">
                      {m.venue && <span className="flex items-center gap-1"><MapPin size={10} /> {m.venue}</span>}
                      {m.start_time && <span className="flex items-center gap-1"><Clock size={10} /> {new Date(m.start_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} &middot; {new Date(m.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2.5 py-1 rounded-full text-2xs font-medium border ${STATUS_COLORS[m.status] || 'bg-zinc-800 text-zinc-500'}`}>{m.status}</span>
                  <button onClick={() => startEdit(m)} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors" title="Edit"><Edit3 size={14} /></button>
                  <button onClick={() => handleDelete(m.match_id)} className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
