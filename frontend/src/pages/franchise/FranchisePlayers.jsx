import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useWallet } from '../../contexts/WalletContext';
import { Users2, Plus, Save, XCircle, Edit3, Search } from 'lucide-react';
const H = (addr) => ({ 'x-wallet-address': addr || '', 'Content-Type': 'application/json' });
const API = '/api/franchise-portal';
const ROLES = ['BAT', 'BOWL', 'ALL', 'WK'];
const ROLE_LABELS = { BAT: 'Batter', BOWL: 'Bowler', ALL: 'All-rounder', WK: 'Wicketkeeper' };
const ROLE_COLORS = { BAT: 'text-blue-400 bg-blue-500/10', BOWL: 'text-green-400 bg-green-500/10', ALL: 'text-purple-400 bg-purple-500/10', WK: 'text-yellow-400 bg-yellow-500/10' };

export default function FranchisePlayers() {
  const { address } = useWallet();
  const { franchise } = useOutletContext();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ player_id: '', name: '', team: '', role: 'BAT', credits: 7 });
  const [msg, setMsg] = useState(null);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');

  const teams = [...new Set(players.filter(p => p.active !== false).map(p => p.team))].sort();

  async function load() {
    try {
      const res = await fetch(`${API}/players?limit=500`, { headers: H(address) });
      if (res.ok) {
        const data = await res.json();
        setPlayers(Array.isArray(data) ? data : (data?.rows || []));
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, [address]);

  function startNew() {
    setForm({
      player_id: players.length > 0 ? Math.max(...players.map(p => p.player_id)) + 1 : 1,
      name: '', team: teams[0] || '', role: 'BAT', credits: 7,
    });
    setEditing(null); setShowForm(true); setMsg(null);
  }

  function startEdit(p) {
    setForm({ player_id: p.player_id, name: p.name, team: p.team, role: p.role, credits: Number(p.credits) });
    setEditing(p.player_id); setShowForm(true); setMsg(null);
  }

  async function handleSubmit(e) {
    e.preventDefault(); setMsg(null);
    try {
      const res = await fetch(`${API}/players`, { method: 'POST', headers: H(address), body: JSON.stringify(form) });
      if (!res.ok) throw new Error((await res.json()).error);
      setMsg({ type: 'success', text: editing ? `Player "${form.name}" updated` : `Player "${form.name}" added` });
      setShowForm(false); setEditing(null); await load();
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  }

  async function handleDeactivate(pid, name) {
    if (!confirm(`Deactivate ${name} (#${pid})?`)) return;
    await fetch(`${API}/players/${pid}`, { method: 'DELETE', headers: H(address) });
    setMsg({ type: 'success', text: `${name} deactivated` }); await load();
  }

  const allTeams = {};
  players.forEach(p => { (allTeams[p.team] = allTeams[p.team] || []).push(p); });

  const filteredTeams = Object.entries(allTeams)
    .map(([team, ps]) => [team, ps.filter(p => {
      if (filterRole !== 'ALL' && p.role !== filterRole) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })])
    .filter(([, ps]) => ps.length > 0);

  const totalActive = players.filter(p => p.active !== false).length;

  if (loading) return <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-zinc-900/70 rounded-2xl animate-pulse" />)}</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Users2 size={22} className="text-emerald-400" /> Player Roster</h1>
          <p className="text-sm text-zinc-500 mt-1">{totalActive} active players across {teams.length} teams</p>
        </div>
        <button onClick={startNew} className="btn-primary text-sm flex items-center gap-1.5"><Plus size={14} /> Add Player</button>
      </div>

      {msg && <div className={`rounded-xl px-4 py-3 text-sm ${msg.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-400/5 border border-red-400/20 text-red-400'}`}>{msg.text}</div>}

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search players..." className="input pl-9 w-full" />
        </div>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="input w-auto">
          <option value="ALL">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-6 space-y-4 animate-fade-in">
          <h3 className="text-sm font-semibold text-white">{editing ? `Edit Player #${editing}` : 'Add New Player'}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <label className="form-label">Player ID</label>
              <input type="number" value={form.player_id} onChange={e => setForm(f => ({ ...f, player_id: Number(e.target.value) }))} required className="input" disabled={!!editing} />
            </div>
            <div>
              <label className="form-label">Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="input" placeholder="Player name" />
            </div>
            <div>
              <label className="form-label">Team</label>
              <select value={form.team} onChange={e => setForm(f => ({ ...f, team: e.target.value }))} required className="input">
                <option value="">Select team...</option>
                {teams.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Role</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="input">
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]} ({r})</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Credits</label>
              <input type="number" step="0.5" min="1" max="20" value={form.credits} onChange={e => setForm(f => ({ ...f, credits: Number(e.target.value) }))} className="input" />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary text-sm flex items-center gap-1.5"><Save size={14} /> {editing ? 'Update Player' : 'Add Player'}</button>
            <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="btn-secondary text-sm">Cancel</button>
          </div>
        </form>
      )}

      {/* Player tables grouped by team */}
      {filteredTeams.length === 0 ? (
        <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-12 text-center text-zinc-500 text-sm">No players match your filters</div>
      ) : filteredTeams.map(([team, teamPlayers]) => (
        <div key={team}>
          <h2 className="text-sm font-bold text-zinc-300 mb-2 flex items-center gap-2">
            {team}
            <span className="text-zinc-600 font-normal text-xs">({teamPlayers.filter(p => p.active !== false).length} active)</span>
          </h2>
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="text-zinc-500 text-left border-b border-zinc-800">
                <th className="px-4 py-3 font-medium w-16">ID</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Credits</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium w-20 text-right">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-zinc-800/50">
                {teamPlayers.map(p => (
                  <tr key={p.player_id} className={`hover:bg-zinc-800/30 ${p.active === false ? 'opacity-40' : ''}`}>
                    <td className="px-4 py-2.5 font-mono text-zinc-500 text-xs">{p.player_id}</td>
                    <td className="px-4 py-2.5 font-medium text-white">{p.name}</td>
                    <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-2xs font-medium ${ROLE_COLORS[p.role] || ''}`}>{ROLE_LABELS[p.role] || p.role}</span></td>
                    <td className="px-4 py-2.5 text-accent font-bold">{Number(p.credits)}</td>
                    <td className="px-4 py-2.5">{p.active !== false ? <span className="text-emerald-400 text-2xs font-medium">Active</span> : <span className="text-red-400 text-2xs">Inactive</span>}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {p.active !== false && (
                          <>
                            <button onClick={() => startEdit(p)} className="p-1 rounded text-zinc-600 hover:text-white hover:bg-zinc-800 transition-colors" title="Edit"><Edit3 size={13} /></button>
                            <button onClick={() => handleDeactivate(p.player_id, p.name)} className="p-1 rounded text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Deactivate"><XCircle size={13} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

    </div>
  );
}
