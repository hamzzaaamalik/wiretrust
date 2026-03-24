import { useState, useEffect } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { Trophy, Plus, Save, XCircle, Edit3, Eye } from 'lucide-react';
import Pagination from '../../components/ui/Pagination';

const H = (addr) => ({ 'x-wallet-address': addr || '', 'Content-Type': 'application/json' });
const CATEGORIES = ['TICKET', 'EXPERIENCE', 'COLLECTIBLE', 'BADGE', 'MERCHANDISE'];
const CONDITIONS = ['PREDICTIONS_MADE', 'PREDICTION_STREAK', 'PREDICTION_POINTS', 'CORRECT_PREDICTIONS', 'FANTASY_JOINS', 'AGENT_CREATED', 'REPUTATION_SCORE', 'NFTS_EARNED'];
const CAT_COLORS = { TICKET: 'text-blue-400 bg-blue-500/10 border-blue-500/20', EXPERIENCE: 'text-purple-400 bg-purple-500/10 border-purple-500/20', COLLECTIBLE: 'text-amber-400 bg-amber-500/10 border-amber-500/20', BADGE: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', MERCHANDISE: 'text-pink-400 bg-pink-500/10 border-pink-500/20' };
const CAT_ICONS = { TICKET: '🎫', EXPERIENCE: '⭐', COLLECTIBLE: '💎', BADGE: '🏅', MERCHANDISE: '👕' };
const COND_LABELS = {
  PREDICTIONS_MADE: 'Total Predictions Made',
  PREDICTION_STREAK: 'Prediction Streak',
  PREDICTION_POINTS: 'Prediction Points',
  CORRECT_PREDICTIONS: 'Correct Predictions',
  FANTASY_JOINS: 'Squad Challenges Joined',
  AGENT_CREATED: 'Agents Created',
  REPUTATION_SCORE: 'Reputation Score',
  NFTS_EARNED: 'NFTs Earned',
};

const emptyForm = {
  id: '', franchise_id: 1, name: '', description: '', category: 'BADGE',
  condition_type: 'PREDICTIONS_MADE', condition_target: 1,
  reward_name: '', reward_description: '', reward_category: 3, max_claims: 0,
};

export default function AdminChallenges() {
  const { address } = useWallet();
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [msg, setMsg] = useState(null);
  const [filterCat, setFilterCat] = useState('ALL');
  const [expandedId, setExpandedId] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  async function load() {
    try {
      const res = await fetch(`/api/admin/challenges?page=${page}&limit=25`, { headers: H(address) });
      if (res.ok) {
        const data = await res.json();
        setChallenges(Array.isArray(data) ? data : (data.rows || []));
        setTotalPages(data.totalPages || 1);
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, [address, page]);

  function startNew() {
    setForm({ ...emptyForm });
    setEditing(null);
    setShowForm(true);
    setMsg(null);
  }

  function startEdit(c) {
    setForm({
      id: c.id,
      franchise_id: c.franchise_id,
      name: c.name,
      description: c.description || '',
      category: c.category,
      condition_type: c.condition_type,
      condition_target: c.condition_target,
      reward_name: c.reward_name || '',
      reward_description: c.reward_description || '',
      reward_category: CATEGORIES.indexOf(c.category),
      max_claims: c.max_claims || 0,
    });
    setEditing(c.id);
    setShowForm(true);
    setMsg(null);
  }

  // Auto-generate slug from category + name
  function autoSlug(cat, name) {
    const prefix = cat.slice(0, 3).toLowerCase();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `${prefix}-${slug}`;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg(null);
    const payload = { ...form, reward_category: CATEGORIES.indexOf(form.category) };
    if (!editing && !payload.id) payload.id = autoSlug(payload.category, payload.name);
    try {
      const res = await fetch('/api/admin/challenges', { method: 'POST', headers: H(address), body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).error);
      setMsg({ type: 'success', text: editing ? `Challenge "${form.name}" updated!` : `Challenge "${form.name}" created!` });
      setShowForm(false);
      setEditing(null);
      await load();
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  }

  async function handleDeactivate(id, name) {
    if (!confirm(`Deactivate challenge "${name}"?`)) return;
    await fetch(`/api/admin/challenges/${id}`, { method: 'DELETE', headers: H(address) });
    setMsg({ type: 'success', text: `"${name}" deactivated` });
    await load();
  }

  // Group by category
  const grouped = {};
  challenges.forEach(c => { (grouped[c.category] = grouped[c.category] || []).push(c); });

  const filtered = filterCat === 'ALL' ? CATEGORIES : [filterCat];
  const totalActive = challenges.filter(c => c.active).length;

  if (loading) return <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-zinc-900/70 rounded-2xl animate-pulse" />)}</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Trophy size={22} className="text-amber-400" /> Challenges</h1>
          <p className="text-sm text-zinc-500 mt-1">{totalActive} active across {Object.keys(grouped).length} categories</p>
        </div>
        <button onClick={startNew} className="btn-primary text-sm flex items-center gap-1.5"><Plus size={14} /> Add Challenge</button>
      </div>

      {msg && <div className={`rounded-xl px-4 py-3 text-sm ${msg.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-400/5 border border-red-400/20 text-red-400'}`}>{msg.text}</div>}

      {/* Category filter */}
      <div className="flex gap-1.5 flex-wrap">
        <button onClick={() => setFilterCat('ALL')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filterCat === 'ALL' ? 'bg-zinc-700 text-white' : 'bg-zinc-900/50 text-zinc-500 hover:text-zinc-300'}`}>
          All ({challenges.length})
        </button>
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setFilterCat(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${filterCat === cat ? 'bg-zinc-700 text-white' : 'bg-zinc-900/50 text-zinc-500 hover:text-zinc-300'}`}>
            {CAT_ICONS[cat]} {cat} ({(grouped[cat] || []).length})
          </button>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-6 space-y-4 animate-fade-in">
          <h3 className="text-sm font-semibold text-white">{editing ? `Edit Challenge` : 'New Challenge'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="form-label">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value, reward_category: CATEGORIES.indexOf(e.target.value) }))} className="input">
                {CATEGORIES.map(c => <option key={c} value={c}>{CAT_ICONS[c]} {c}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value, id: editing ? f.id : autoSlug(f.category, e.target.value) }))} required className="input" placeholder="Challenge name" />
            </div>
            <div>
              <label className="form-label">Slug ID <span className="text-zinc-600">(auto)</span></label>
              <input value={form.id} onChange={e => setForm(f => ({ ...f, id: e.target.value }))} required className="input text-zinc-500" disabled={!!editing} />
            </div>
            <div>
              <label className="form-label">Condition</label>
              <select value={form.condition_type} onChange={e => setForm(f => ({ ...f, condition_type: e.target.value }))} className="input">
                {CONDITIONS.map(c => <option key={c} value={c}>{COND_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Target Value</label>
              <input type="number" min="1" value={form.condition_target} onChange={e => setForm(f => ({ ...f, condition_target: Number(e.target.value) }))} className="input" />
            </div>
            <div>
              <label className="form-label">Max Claims <span className="text-zinc-600">(0 = unlimited)</span></label>
              <input type="number" min="0" value={form.max_claims} onChange={e => setForm(f => ({ ...f, max_claims: Number(e.target.value) }))} className="input" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="form-label">Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input" placeholder="What fans need to do..." />
            </div>
            <div>
              <label className="form-label">Reward Name</label>
              <input value={form.reward_name} onChange={e => setForm(f => ({ ...f, reward_name: e.target.value }))} className="input" placeholder="Badge/item name" />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">Reward Description</label>
              <input value={form.reward_description} onChange={e => setForm(f => ({ ...f, reward_description: e.target.value }))} className="input" placeholder="What the fan receives" />
            </div>
          </div>

          {/* Preview */}
          <div className="bg-zinc-800/40 rounded-xl p-4 border border-zinc-700/30">
            <div className="text-2xs text-zinc-500 uppercase font-medium mb-2">Preview</div>
            <div className="flex items-center gap-3">
              <span className={`px-2.5 py-1 rounded-full text-2xs font-medium border ${CAT_COLORS[form.category]}`}>
                {CAT_ICONS[form.category]} {form.category}
              </span>
              <span className="text-white font-medium text-sm">{form.name || 'Challenge Name'}</span>
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              {COND_LABELS[form.condition_type]} ≥ {form.condition_target} → Reward: {form.reward_name || '-'} · Max: {form.max_claims || '∞'}
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" className="btn-primary text-sm flex items-center gap-1.5"><Save size={14} /> {editing ? 'Update' : 'Create'}</button>
            <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="btn-secondary text-sm">Cancel</button>
          </div>
        </form>
      )}

      {/* Challenge list */}
      {filtered.map(cat => {
        const items = grouped[cat];
        if (!items?.length) return null;
        return (
          <div key={cat}>
            <h2 className="text-sm font-bold text-zinc-300 mb-2 flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-2xs font-medium border ${CAT_COLORS[cat]}`}>{CAT_ICONS[cat]} {cat}</span>
              <span className="text-zinc-600 font-normal text-xs">{items.filter(c => c.active).length} active</span>
            </h2>
            <div className="space-y-2">
              {items.map(c => (
                <div key={c.id} className={`bg-zinc-900/70 border border-zinc-800/80 rounded-xl transition-all ${!c.active ? 'opacity-40' : 'hover:border-zinc-700/60'}`}>
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-white text-sm">{c.name}</div>
                      <div className="text-2xs text-zinc-500 mt-0.5">
                        {COND_LABELS[c.condition_type] || c.condition_type} ≥ {c.condition_target} · Max: {c.max_claims || '∞'} · Reward: {c.reward_name}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setExpandedId(expandedId === c.id ? null : c.id)} className="p-1.5 rounded-lg text-zinc-600 hover:text-white hover:bg-zinc-800 transition-colors" title="Details"><Eye size={13} /></button>
                      {c.active && (
                        <>
                          <button onClick={() => startEdit(c)} className="p-1.5 rounded-lg text-zinc-600 hover:text-white hover:bg-zinc-800 transition-colors" title="Edit"><Edit3 size={13} /></button>
                          <button onClick={() => handleDeactivate(c.id, c.name)} className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Deactivate"><XCircle size={13} /></button>
                        </>
                      )}
                    </div>
                  </div>
                  {expandedId === c.id && (
                    <div className="px-4 pb-4 pt-0 border-t border-zinc-800/50 mt-0">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-xs">
                        <div><span className="text-zinc-500">Slug:</span> <span className="text-zinc-400 font-mono">{c.id}</span></div>
                        <div><span className="text-zinc-500">Franchise:</span> <span className="text-zinc-400">#{c.franchise_id}</span></div>
                        <div><span className="text-zinc-500">Reward:</span> <span className="text-zinc-400">{c.reward_name}</span></div>
                        <div><span className="text-zinc-500">Status:</span> <span className={c.active ? 'text-emerald-400' : 'text-red-400'}>{c.active ? 'Active' : 'Inactive'}</span></div>
                      </div>
                      {c.description && <div className="text-xs text-zinc-500 mt-2">{c.description}</div>}
                      {c.reward_description && <div className="text-xs text-zinc-600 mt-1 italic">{c.reward_description}</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
