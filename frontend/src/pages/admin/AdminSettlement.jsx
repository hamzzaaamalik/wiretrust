import { useState, useEffect } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { Gavel, Trophy, Wallet, PlusCircle, DollarSign, CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react';

const H = (addr) => ({ 'x-wallet-address': addr || '', 'Content-Type': 'application/json' });

export default function AdminSettlement() {
  const { address } = useWallet();

  // Shared
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Section 1: Settle Match
  const [settleMatchId, setSettleMatchId] = useState('');
  const [settleWinner, setSettleWinner] = useState('team1');
  const [settleAbandoned, setSettleAbandoned] = useState(false);
  const [settleResult, setSettleResult] = useState(null);
  const [settling, setSettling] = useState(false);

  // Section 2: Create Contest
  const [contestMatchId, setContestMatchId] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(0);
  const [createResult, setCreateResult] = useState(null);
  const [creating, setCreating] = useState(false);

  // Section 3: Fund Contest
  const [fundContestId, setFundContestId] = useState('');
  const [fundAmount, setFundAmount] = useState('');
  const [fundResult, setFundResult] = useState(null);
  const [funding, setFunding] = useState(false);

  // Section 4: Treasury
  const [treasury, setTreasury] = useState(null);
  const [treasuryLoading, setTreasuryLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/matches?limit=1000', { headers: H(address) })
      .then(r => r.json())
      .then(data => { setMatches(data.rows || data || []); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [address]);

  useEffect(() => {
    fetchTreasury();
  }, [address]);

  function fetchTreasury() {
    setTreasuryLoading(true);
    fetch('/api/admin/treasury', { headers: H(address) })
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json(); })
      .then(data => {
        // Normalize keys to match what the UI expects
        setTreasury({
          ...data,
          franchiseTreasuries: data.franchises || data.franchiseTreasuries || [],
          revenueStreams: Array.isArray(data.revenueStreams) ? data.revenueStreams
            : data.revenueStreams ? Object.values(data.revenueStreams) : [],
          activity: data.activityCounts || data.activity || null,
        });
        setTreasuryLoading(false);
      })
      .catch(() => { setTreasuryLoading(false); });
  }

  const selectedSettleMatch = matches.find(m => m.match_id === Number(settleMatchId));
  const selectedContestMatch = matches.find(m => m.match_id === Number(contestMatchId));

  async function handleSettle(e) {
    e.preventDefault();
    if (!settleMatchId) return;
    setSettling(true);
    setSettleResult(null);
    try {
      const winner = settleAbandoned ? 'NO_RESULT' : settleWinner;
      const res = await fetch(`/api/admin/settle-match/${settleMatchId}`, {
        method: 'POST',
        headers: H(address),
        body: JSON.stringify({ winner, abandoned: settleAbandoned }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Settlement failed');
      setSettleResult({ type: 'success', data });
    } catch (err) {
      setSettleResult({ type: 'error', text: err.message });
    }
    setSettling(false);
  }

  async function handleCreateContest(e) {
    e.preventDefault();
    if (!contestMatchId) return;
    setCreating(true);
    setCreateResult(null);
    try {
      const res = await fetch('/api/admin/contests/create', {
        method: 'POST',
        headers: H(address),
        body: JSON.stringify({
          franchise_id: 1,
          match_id: Number(contestMatchId),
          max_participants: Number(maxParticipants),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Contest creation failed');
      setCreateResult({ type: 'success', data });
    } catch (err) {
      setCreateResult({ type: 'error', text: err.message });
    }
    setCreating(false);
  }

  async function handleFundContest(e) {
    e.preventDefault();
    if (!fundContestId || !fundAmount) return;
    setFunding(true);
    setFundResult(null);
    try {
      const res = await fetch('/api/admin/contests/fund', {
        method: 'POST',
        headers: H(address),
        body: JSON.stringify({
          contest_id: Number(fundContestId),
          amount: Number(fundAmount),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Funding failed');
      setFundResult({ type: 'success', data });
    } catch (err) {
      setFundResult({ type: 'error', text: err.message });
    }
    setFunding(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500 text-sm">
        <Loader2 size={18} className="animate-spin mr-2" /> Loading settlement data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-400/5 border border-red-400/20 text-red-400 rounded-2xl p-6 text-sm flex items-center gap-2">
        <AlertTriangle size={16} /> Failed to load data: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Gavel size={22} className="text-amber-400" /> Settlement & Contests
        </h1>
        <p className="text-sm text-zinc-500 mt-1">Settle matches, create contests, fund prize pools, and view treasury</p>
      </div>

      {/* ── Section 1: Settle Match ── */}
      <form onSubmit={handleSettle} className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Gavel size={14} className="text-emerald-400" /> Settle Match
          <span className="text-2xs text-zinc-600 font-normal ml-2">On-Chain Transaction</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Select Match</label>
            <select value={settleMatchId} onChange={e => setSettleMatchId(e.target.value)} className="input" required>
              <option value="">Choose a match...</option>
              {matches.map(m => (
                <option key={m.match_id} value={m.match_id}>
                  #{m.match_id} - {m.team1} vs {m.team2} ({m.status})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Winner</label>
            <div className="space-y-2">
              {selectedSettleMatch && (
                <>
                  <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                    <input type="radio" name="settleWinner" value="team1" checked={settleWinner === 'team1' && !settleAbandoned} onChange={() => { setSettleWinner('team1'); setSettleAbandoned(false); }} className="accent-emerald-500" />
                    {selectedSettleMatch.team1}
                  </label>
                  <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                    <input type="radio" name="settleWinner" value="team2" checked={settleWinner === 'team2' && !settleAbandoned} onChange={() => { setSettleWinner('team2'); setSettleAbandoned(false); }} className="accent-emerald-500" />
                    {selectedSettleMatch.team2}
                  </label>
                </>
              )}
              <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                <input type="radio" name="settleWinner" value="TIE" checked={settleWinner === 'TIE' && !settleAbandoned} onChange={() => { setSettleWinner('TIE'); setSettleAbandoned(false); }} className="accent-amber-500" />
                TIE
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                <input type="radio" name="settleWinner" value="NO_RESULT" checked={settleWinner === 'NO_RESULT' && !settleAbandoned} onChange={() => { setSettleWinner('NO_RESULT'); setSettleAbandoned(false); }} className="accent-amber-500" />
                NO RESULT
              </label>
              <label className="flex items-center gap-2 text-sm text-red-400 cursor-pointer">
                <input type="radio" name="settleWinner" value="Abandoned" checked={settleAbandoned} onChange={() => { setSettleAbandoned(true); setSettleWinner('NO_RESULT'); }} className="accent-red-500" />
                Abandoned
              </label>
            </div>
          </div>
        </div>

        <button type="submit" disabled={settling || !settleMatchId} className="btn-primary text-sm flex items-center gap-1.5">
          <Gavel size={14} /> {settling ? 'Settling...' : 'Settle Match'}
        </button>

        {settleResult && settleResult.type === 'error' && (
          <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm bg-red-400/5 border border-red-400/20 text-red-400">
            <AlertTriangle size={14} /> {settleResult.text}
          </div>
        )}

        {settleResult && settleResult.type === 'success' && (
          <div className="bg-zinc-800/40 rounded-xl p-4 border border-zinc-700/30 space-y-2">
            <div className="text-2xs text-zinc-500 uppercase font-medium mb-2">Settlement Steps</div>
            {settleResult.data.steps ? (
              settleResult.data.steps.map((step, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  {step.success ? (
                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle size={14} className="text-red-400 shrink-0" />
                  )}
                  <span className={step.success ? 'text-zinc-300' : 'text-red-400'}>{step.description || step.step || step.message}</span>
                </div>
              ))
            ) : (
              <div className="flex items-center gap-2 text-sm text-emerald-400">
                <CheckCircle2 size={14} /> Settlement completed successfully
                {settleResult.data.txHash && <span className="text-zinc-500 ml-1">Tx: {settleResult.data.txHash.slice(0, 14)}...</span>}
              </div>
            )}
          </div>
        )}
      </form>

      {/* ── Section 2: Create Contest ── */}
      <form onSubmit={handleCreateContest} className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <PlusCircle size={14} className="text-blue-400" /> Create Contest
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="form-label">Franchise</label>
            <div className="input bg-zinc-800/50 text-zinc-400 cursor-not-allowed">Franchise #1</div>
          </div>
          <div>
            <label className="form-label">Match</label>
            <select value={contestMatchId} onChange={e => setContestMatchId(e.target.value)} className="input" required>
              <option value="">Choose a match...</option>
              {matches.map(m => (
                <option key={m.match_id} value={m.match_id}>
                  #{m.match_id} - {m.team1} vs {m.team2} ({m.status})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Max Participants</label>
            <input
              type="number"
              min="0"
              value={maxParticipants}
              onChange={e => setMaxParticipants(Number(e.target.value))}
              className="input"
              placeholder="0 = unlimited"
            />
            <span className="text-2xs text-zinc-600 mt-1 block">0 = unlimited</span>
          </div>
        </div>

        <button type="submit" disabled={creating || !contestMatchId} className="btn-primary text-sm flex items-center gap-1.5">
          <PlusCircle size={14} /> {creating ? 'Creating...' : 'Create Contest'}
        </button>

        {createResult && createResult.type === 'error' && (
          <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm bg-red-400/5 border border-red-400/20 text-red-400">
            <AlertTriangle size={14} /> {createResult.text}
          </div>
        )}

        {createResult && createResult.type === 'success' && (
          <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <CheckCircle2 size={14} />
            Contest created! ID: <span className="font-mono font-bold text-white">{createResult.data.contestId ?? createResult.data.contest_id ?? 'N/A'}</span>
          </div>
        )}
      </form>

      {/* ── Section 3: Fund Contest ── */}
      <form onSubmit={handleFundContest} className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <DollarSign size={14} className="text-amber-400" /> Fund Contest
          <span className="text-2xs text-zinc-600 font-normal ml-2">On-Chain Transaction</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Contest ID</label>
            <input
              type="number"
              min="1"
              value={fundContestId}
              onChange={e => setFundContestId(e.target.value)}
              className="input"
              placeholder="Enter contest ID"
              required
            />
          </div>
          <div>
            <label className="form-label">Amount (WIRE)</label>
            <input
              type="number"
              min="0"
              step="any"
              value={fundAmount}
              onChange={e => setFundAmount(e.target.value)}
              className="input"
              placeholder="e.g. 1000"
              required
            />
          </div>
        </div>

        <button type="submit" disabled={funding || !fundContestId || !fundAmount} className="btn-primary text-sm flex items-center gap-1.5">
          <DollarSign size={14} /> {funding ? 'Funding...' : 'Fund Contest'}
        </button>

        {fundResult && fundResult.type === 'error' && (
          <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm bg-red-400/5 border border-red-400/20 text-red-400">
            <AlertTriangle size={14} /> {fundResult.text}
          </div>
        )}

        {fundResult && fundResult.type === 'success' && (
          <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <CheckCircle2 size={14} />
            Contest funded! Tx: <span className="font-mono text-white">{fundResult.data.txHash ? `${fundResult.data.txHash.slice(0, 14)}...` : 'confirmed'}</span>
          </div>
        )}
      </form>

      {/* ── Section 4: Treasury Overview ── */}
      <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Wallet size={14} className="text-purple-400" /> Treasury Overview
          </h3>
          <button onClick={fetchTreasury} className="text-2xs text-zinc-500 hover:text-zinc-300 transition-colors">
            Refresh
          </button>
        </div>

        {treasuryLoading && !treasury && (
          <div className="flex items-center gap-2 text-zinc-500 text-sm py-4">
            <Loader2 size={14} className="animate-spin" /> Loading treasury data...
          </div>
        )}

        {!treasuryLoading && !treasury && (
          <div className="text-zinc-500 text-sm py-4">Unable to load treasury data.</div>
        )}

        {treasury && (
          <div className="space-y-4">
            {/* Protocol Treasury */}
            {treasury.protocolTreasury && (
              <div className="bg-zinc-800/40 rounded-xl p-4 border border-zinc-700/30">
                <div className="text-2xs text-zinc-500 uppercase font-medium mb-2">Protocol Treasury</div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400 font-mono">{treasury.protocolTreasury.address || '-'}</span>
                  <span className="text-white font-bold">{treasury.protocolTreasury.balance ?? '-'} WIRE</span>
                </div>
              </div>
            )}

            {/* Signer Wallet */}
            {treasury.signerWallet && (
              <div className="bg-zinc-800/40 rounded-xl p-4 border border-zinc-700/30">
                <div className="text-2xs text-zinc-500 uppercase font-medium mb-2">Signer Wallet</div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400 font-mono">{treasury.signerWallet.address || '-'}</span>
                  <span className="text-white font-bold">{treasury.signerWallet.balance ?? '-'} SOL</span>
                </div>
              </div>
            )}

            {/* Franchise Treasuries */}
            {treasury.franchiseTreasuries && treasury.franchiseTreasuries.length > 0 && (
              <div className="bg-zinc-800/40 rounded-xl p-4 border border-zinc-700/30">
                <div className="text-2xs text-zinc-500 uppercase font-medium mb-3">Franchise Treasuries</div>
                <div className="space-y-2">
                  {treasury.franchiseTreasuries.map((ft, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="text-zinc-300 font-medium">{ft.name || `Franchise #${ft.franchiseId || i + 1}`}</span>
                        {(ft.treasuryWallet || ft.address) && <span className="text-zinc-600 font-mono text-xs ml-2">{(ft.treasuryWallet || ft.address).slice(0, 8)}...{(ft.treasuryWallet || ft.address).slice(-4)}</span>}
                      </div>
                      <span className="text-white font-bold">{ft.balance ?? '-'} WIRE</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Revenue Streams */}
            {treasury.revenueStreams && treasury.revenueStreams.length > 0 && (
              <div className="bg-zinc-800/40 rounded-xl p-4 border border-zinc-700/30">
                <div className="text-2xs text-zinc-500 uppercase font-medium mb-3">Revenue Streams</div>
                <div className="space-y-1.5">
                  {treasury.revenueStreams.map((rs, i) => (
                    <div key={i} className="text-sm text-zinc-400">{rs.description || rs.name || rs}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Activity Counts */}
            {treasury.activity && (
              <div className="bg-zinc-800/40 rounded-xl p-4 border border-zinc-700/30">
                <div className="text-2xs text-zinc-500 uppercase font-medium mb-3">Activity</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(treasury.activity).map(([key, val]) => (
                    <div key={key} className="text-center">
                      <div className="text-xl font-bold text-white">{val}</div>
                      <div className="text-2xs text-zinc-500 capitalize">{key.replace(/_/g, ' ')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
