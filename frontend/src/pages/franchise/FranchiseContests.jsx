import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useWallet } from '../../contexts/WalletContext';
import { Trophy, Plus, DollarSign, Gavel, Users, Loader2, CheckCircle2, AlertCircle, Coins, Megaphone, Image } from 'lucide-react';

const API = '/api/franchise-portal';
const FANTASY_API = '/api/fantasy';

const OUTCOMES = [
  { value: 'team1', label: 'Team 1 Wins' },
  { value: 'team2', label: 'Team 2 Wins' },
  { value: 'TIE', label: 'Tie / Draw' },
  { value: 'Abandoned', label: 'Abandoned' },
];

const STATUS_COLORS = {
  active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  finalized: 'bg-zinc-700/30 text-zinc-400 border-zinc-700/30',
};

function Msg({ msg }) {
  if (!msg) return null;
  return (
    <div className={`rounded-xl px-4 py-3 text-sm flex items-start gap-2 ${msg.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-400/5 border border-red-400/20 text-red-400'}`}>
      {msg.type === 'success' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
      <div>{msg.text}</div>
    </div>
  );
}

export default function FranchiseContests() {
  const { address } = useWallet();
  const { franchise } = useOutletContext();

  const [matches, setMatches] = useState([]);
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create contest state
  const [createForm, setCreateForm] = useState({ match_id: '', max_participants: 0, sponsor_name: '', sponsor_logo: '', banner_url: '' });
  const [createMsg, setCreateMsg] = useState(null);
  const [creating, setCreating] = useState(false);

  // Fund contest state
  const [fundForm, setFundForm] = useState({ contest_id: '', amount_wire: '' });
  const [fundMsg, setFundMsg] = useState(null);
  const [funding, setFunding] = useState(false);

  // Settle match state
  const [settleForm, setSettleForm] = useState({ match_id: '', winner: 'team1' });
  const [settleMsg, setSettleMsg] = useState(null);
  const [settling, setSettling] = useState(false);

  // Quick fund (inline on contest cards)
  const [quickFund, setQuickFund] = useState({ id: null, amount: '' });
  const [quickFundLoading, setQuickFundLoading] = useState(false);

  const H = () => ({ 'x-wallet-address': address || '', 'Content-Type': 'application/json' });

  async function loadData() {
    try {
      const [mr, cr] = await Promise.all([
        fetch(`${API}/matches?page=1&limit=1000`, { credentials: 'include', headers: H() }).then(r => r.json()),
        fetch(`${FANTASY_API}/all-contests`).then(r => r.json()),
      ]);
      setMatches(Array.isArray(mr) ? mr : (mr?.rows || []));
      setContests(Array.isArray(cr) ? cr : []);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [address]);

  // --- Create Contest ---
  async function handleCreate(e) {
    e.preventDefault();
    setCreateMsg(null);
    setCreating(true);
    try {
      const res = await fetch(`${API}/contests/create`, {
        method: 'POST',
        credentials: 'include',
        headers: H(),
        body: JSON.stringify({
          match_id: Number(createForm.match_id),
          max_participants: Number(createForm.max_participants),
          sponsor_name: createForm.sponsor_name || undefined,
          sponsor_logo: createForm.sponsor_logo || undefined,
          banner_url: createForm.banner_url || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create contest');
      const newId = data.contestId || data.contest_id || '';
      setCreateMsg({
        type: 'success',
        text: `Contest created! ID: ${newId || '-'}${data.txHash ? ` · Tx: ${data.txHash.slice(0, 10)}...${data.txHash.slice(-6)}` : ''}`,
      });
      setCreateForm({ match_id: '', max_participants: 0, sponsor_name: '', sponsor_logo: '', banner_url: '' });
      // Auto-fill fund form with newly created contest
      if (newId) setFundForm(f => ({ ...f, contest_id: String(newId) }));
      await loadData();
    } catch (err) {
      setCreateMsg({ type: 'error', text: err.message });
    }
    setCreating(false);
  }

  // --- Fund Contest ---
  async function handleFund(e, contestId, amountWire) {
    e.preventDefault();
    const isQuick = contestId !== undefined;
    if (isQuick) setQuickFundLoading(true);
    else { setFundMsg(null); setFunding(true); }

    const cid = contestId ?? fundForm.contest_id;
    const amt = amountWire ?? fundForm.amount_wire;

    try {
      const res = await fetch(`${API}/contests/fund`, {
        method: 'POST',
        credentials: 'include',
        headers: H(),
        body: JSON.stringify({ contest_id: Number(cid), amount_wire: Number(amt) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fund contest');
      const msg = { type: 'success', text: `Funded contest #${cid} with ${amt} WIRE${data.txHash ? ` · Tx: ${data.txHash.slice(0, 10)}...${data.txHash.slice(-6)}` : ''}` };
      if (isQuick) { setQuickFund({ id: null, amount: '' }); setFundMsg(msg); }
      else { setFundMsg(msg); setFundForm({ contest_id: '', amount_wire: '' }); }
      await loadData();
    } catch (err) {
      const errMsg = { type: 'error', text: err.message };
      if (isQuick) setFundMsg(errMsg);
      else setFundMsg(errMsg);
    }
    if (isQuick) setQuickFundLoading(false);
    else setFunding(false);
  }

  // --- Settle Match ---
  async function handleSettle(e) {
    e.preventDefault();
    setSettleMsg(null);
    setSettling(true);
    try {
      const res = await fetch(`${API}/settle-match/${settleForm.match_id}`, {
        method: 'POST',
        credentials: 'include',
        headers: H(),
        body: JSON.stringify({ winner: settleForm.winner }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to settle match');
      setSettleMsg({ type: 'success', text: `Match #${settleForm.match_id} settled as "${settleForm.winner}"` });
      setSettleForm({ match_id: '', winner: 'team1' });
      await loadData();
    } catch (err) {
      setSettleMsg({ type: 'error', text: err.message });
    }
    setSettling(false);
  }

  // --- Match label helper ---
  function matchLabel(m) {
    return `#${m.match_id} - ${m.team1} vs ${m.team2}`;
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-20 bg-zinc-900/70 rounded-2xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Trophy size={22} className="text-blue-400" /> Squad Challenges
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          {contests.length} contest{contests.length !== 1 ? 's' : ''} · {matches.length} matches available
        </p>
      </div>

      {/* Section 1: Create New Contest */}
      <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Plus size={16} className="text-emerald-400" /> Create New Contest
        </h2>
        <Msg msg={createMsg} />
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="form-label">Match</label>
              <select
                value={createForm.match_id}
                onChange={e => setCreateForm(f => ({ ...f, match_id: e.target.value }))}
                required
                className="input"
              >
                <option value="">Select match...</option>
                {matches.map(m => (
                  <option key={m.match_id} value={m.match_id}>{matchLabel(m)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Max Participants (0 = unlimited)</label>
              <input
                type="number"
                min="0"
                value={createForm.max_participants}
                onChange={e => setCreateForm(f => ({ ...f, max_participants: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className="form-label flex items-center gap-1.5">
                <Megaphone size={12} className="text-amber-400" /> Sponsor Name
              </label>
              <input
                type="text"
                value={createForm.sponsor_name}
                onChange={e => setCreateForm(f => ({ ...f, sponsor_name: e.target.value }))}
                placeholder="e.g. Pepsi, Jazz, Daraz"
                className="input"
                maxLength={200}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label flex items-center gap-1.5">
                <Image size={12} className="text-blue-400" /> Sponsor Logo URL
              </label>
              <input
                type="url"
                value={createForm.sponsor_logo}
                onChange={e => setCreateForm(f => ({ ...f, sponsor_logo: e.target.value }))}
                placeholder="https://brand.com/logo.png"
                className="input"
              />
            </div>
            <div>
              <label className="form-label flex items-center gap-1.5">
                <Image size={12} className="text-purple-400" /> Contest Banner URL
              </label>
              <input
                type="url"
                value={createForm.banner_url}
                onChange={e => setCreateForm(f => ({ ...f, banner_url: e.target.value }))}
                placeholder="https://brand.com/banner.jpg"
                className="input"
              />
            </div>
          </div>
          {/* Banner preview */}
          {createForm.banner_url && (
            <div className="rounded-xl overflow-hidden border border-zinc-800/60 max-h-32">
              <img src={createForm.banner_url} alt="Banner preview" className="w-full h-32 object-cover" onError={e => { e.target.style.display = 'none'; }} />
            </div>
          )}
          <button type="submit" disabled={creating || !createForm.match_id} className="btn-primary text-sm flex items-center justify-center gap-1.5 h-10">
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Create Contest
          </button>
        </form>
      </div>

      {/* Section 2: Fund Contest */}
      <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <DollarSign size={16} className="text-amber-400" /> Fund Contest
        </h2>
        <Msg msg={fundMsg} />
        <form onSubmit={(e) => handleFund(e)} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <label className="form-label">Contest</label>
            <select
              value={fundForm.contest_id}
              onChange={e => setFundForm(f => ({ ...f, contest_id: e.target.value }))}
              required
              className="input"
            >
              <option value="">Select contest...</option>
              {contests.filter(c => !c.finalized).map(c => {
                const cid = c.contest_id ?? c.contestId ?? c.id;
                return <option key={cid} value={cid}>#{cid} - {c.matchName || c.match_name || `Match #${c.match_id || '-'}`} ({c.sponsorPool ?? c.sponsor_pool ?? 0} WIRE)</option>;
              })}
            </select>
          </div>
          <div>
            <label className="form-label">Amount (WIRE)</label>
            <input
              type="number"
              min="0"
              step="any"
              value={fundForm.amount_wire}
              onChange={e => setFundForm(f => ({ ...f, amount_wire: e.target.value }))}
              required
              placeholder="e.g. 500"
              className="input"
            />
          </div>
          <button type="submit" disabled={funding || !fundForm.contest_id || !fundForm.amount_wire} className="btn-primary text-sm flex items-center justify-center gap-1.5 h-10">
            {funding ? <Loader2 size={14} className="animate-spin" /> : <Coins size={14} />}
            Fund Prize Pool
          </button>
        </form>
      </div>

      {/* Section 3: Existing Contests */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Trophy size={16} className="text-blue-400" /> Existing Contests
        </h2>
        {contests.length === 0 ? (
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-12 text-center text-zinc-500 text-sm">
            No contests found. Create one above.
          </div>
        ) : (
          <div className="space-y-2">
            {contests.map(c => {
              const cid = c.contest_id ?? c.contestId ?? c.id;
              const status = c.finalized ? 'finalized' : 'active';
              const isQuickOpen = quickFund.id === cid;
              return (
                <div key={cid} className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-4 hover:border-zinc-700/60 transition-all">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 shrink-0">
                        #{cid}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-white text-sm">
                          {c.matchName || c.match_name || `Match #${c.match_id || '-'}`}
                        </div>
                        <div className="flex items-center gap-3 text-2xs text-zinc-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Coins size={10} /> {c.sponsorPool ?? c.sponsor_pool ?? 0} WIRE
                          </span>
                          <span className="flex items-center gap-1">
                            <Users size={10} /> {c.participantCount ?? c.participant_count ?? 0} participants
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2.5 py-1 rounded-full text-2xs font-medium border ${STATUS_COLORS[status]}`}>
                        {status}
                      </span>
                      {status === 'active' && (
                        <button
                          onClick={() => setQuickFund(isQuickOpen ? { id: null, amount: '' } : { id: cid, amount: '' })}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors flex items-center gap-1"
                        >
                          <DollarSign size={12} /> Fund
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Quick fund inline form */}
                  {isQuickOpen && (
                    <form
                      onSubmit={e => handleFund(e, cid, quickFund.amount)}
                      className="mt-3 pt-3 border-t border-zinc-800/80 flex items-end gap-3"
                    >
                      <div className="flex-1">
                        <label className="form-label">Amount (WIRE)</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={quickFund.amount}
                          onChange={e => setQuickFund(f => ({ ...f, amount: e.target.value }))}
                          required
                          placeholder="e.g. 500"
                          className="input"
                          autoFocus
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={quickFundLoading || !quickFund.amount}
                        className="btn-primary text-sm flex items-center gap-1.5 h-10 px-4"
                      >
                        {quickFundLoading ? <Loader2 size={14} className="animate-spin" /> : <Coins size={14} />}
                        Fund
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickFund({ id: null, amount: '' })}
                        className="btn-secondary text-sm h-10"
                      >
                        Cancel
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 4: Settle Match */}
      <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Gavel size={16} className="text-red-400" /> Settle Match
        </h2>
        <Msg msg={settleMsg} />
        <form onSubmit={handleSettle} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Match</label>
              <select
                value={settleForm.match_id}
                onChange={e => setSettleForm(f => ({ ...f, match_id: e.target.value }))}
                required
                className="input"
              >
                <option value="">Select match...</option>
                {matches.map(m => (
                  <option key={m.match_id} value={m.match_id}>{matchLabel(m)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Winner / Outcome</label>
              <div className="flex flex-wrap gap-3 mt-1.5">
                {OUTCOMES.map(o => (
                  <label key={o.value} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="settle-winner"
                      value={o.value}
                      checked={settleForm.winner === o.value}
                      onChange={e => setSettleForm(f => ({ ...f, winner: e.target.value }))}
                      className="accent-blue-500"
                    />
                    <span className={`text-sm ${settleForm.winner === o.value ? 'text-white font-medium' : 'text-zinc-400'}`}>
                      {o.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <button type="submit" disabled={settling || !settleForm.match_id} className="btn-primary text-sm flex items-center gap-1.5">
            {settling ? <Loader2 size={14} className="animate-spin" /> : <Gavel size={14} />}
            Settle Match
          </button>
        </form>
      </div>
    </div>
  );
}
