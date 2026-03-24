import { useState, useEffect } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { ethers } from 'ethers';
import { Building2, Plus, CheckCircle2, XCircle } from 'lucide-react';
import friendlyError from '../../utils/friendlyError';

const REGISTRY_ABI = [
  'function registerFranchise(string name, string league, address adminWallet, address treasuryWallet) returns (uint256)',
  'function updateFranchise(uint256 franchiseId, string name, string league, address adminWallet, address treasuryWallet)',
  'function deactivateFranchise(uint256 franchiseId)',
];

export default function AdminFranchises() {
  const { address, signer } = useWallet();
  const [franchises, setFranchises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', league: 'PSL', adminWallet: '', treasuryWallet: '' });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);
  const [addresses, setAddresses] = useState(null);

  async function load() {
    try {
      const [fRes, hRes] = await Promise.all([
        fetch('/api/admin/franchises', { headers: { 'x-wallet-address': address || '' } }),
        fetch('/api/health'),
      ]);
      if (fRes.ok) setFranchises(await fRes.json());
      if (hRes.ok) {
        const h = await hRes.json();
        setAddresses(h.contracts);
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, [address]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!signer || !addresses) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const contract = new ethers.Contract(addresses.franchiseRegistry, REGISTRY_ABI, signer);
      const tx = await contract.registerFranchise(
        form.name, form.league, form.adminWallet || address, form.treasuryWallet || address,
        { gasLimit: 500000n, gasPrice: 10000000000n }
      );
      await tx.wait();
      setMsg({ type: 'success', text: `Franchise "${form.name}" registered on-chain!` });
      setForm({ name: '', league: 'PSL', adminWallet: '', treasuryWallet: '' });
      setShowForm(false);
      await load();
    } catch (err) {
      setMsg({ type: 'error', text: friendlyError(err) });
    }
    setSubmitting(false);
  }

  if (loading) {
    return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-zinc-900/70 rounded-2xl animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Franchises</h1>
          <p className="text-sm text-zinc-500 mt-1">Onboard and manage sports franchises on WireFluid</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary text-sm flex items-center gap-1.5">
          <Plus size={14} /> Register Franchise
        </button>
      </div>

      {msg && (
        <div className={msg.type === 'success' ? 'alert-success' : 'bg-red-400/5 border border-red-400/20 rounded-xl px-4 py-3 text-sm text-red-400'}>
          {msg.text}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-6 space-y-4 animate-fade-in">
          <h3 className="text-sm font-semibold text-white">Register New Franchise</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-2xs text-zinc-500 uppercase tracking-wider font-medium block mb-1.5">Franchise Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. The Pindiz" required className="input" />
            </div>
            <div>
              <label className="text-2xs text-zinc-500 uppercase tracking-wider font-medium block mb-1.5">League</label>
              <input value={form.league} onChange={e => setForm(f => ({ ...f, league: e.target.value }))} placeholder="e.g. PSL" className="input" />
            </div>
            <div>
              <label className="text-2xs text-zinc-500 uppercase tracking-wider font-medium block mb-1.5">Admin Wallet</label>
              <input value={form.adminWallet} onChange={e => setForm(f => ({ ...f, adminWallet: e.target.value }))} placeholder={address || '0x...'} className="input font-mono text-xs" />
            </div>
            <div>
              <label className="text-2xs text-zinc-500 uppercase tracking-wider font-medium block mb-1.5">Treasury Wallet</label>
              <input value={form.treasuryWallet} onChange={e => setForm(f => ({ ...f, treasuryWallet: e.target.value }))} placeholder={address || '0x...'} className="input font-mono text-xs" />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={submitting} className="btn-primary text-sm">{submitting ? 'Registering...' : 'Register On-Chain'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </form>
      )}

      {/* Franchise list */}
      <div className="space-y-3">
        {franchises.length === 0 ? (
          <div className="text-center py-16 bg-zinc-900/70 border border-zinc-800/80 rounded-2xl">
            <Building2 size={32} className="text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 font-medium">No franchises registered yet</p>
            <p className="text-zinc-600 text-sm mt-1">Click "Register Franchise" to onboard the first one</p>
          </div>
        ) : (
          franchises.map(f => (
            <div key={f.franchiseId} className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5 hover:border-zinc-700/60 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-600/10 flex items-center justify-center">
                    <Building2 size={18} className="text-violet-400" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">{f.name}</div>
                    <div className="text-2xs text-zinc-500">{f.league} &middot; ID #{f.franchiseId}</div>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-2xs font-medium ${
                  f.active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}>
                  {f.active ? <><CheckCircle2 size={10} /> Active</> : <><XCircle size={10} /> Inactive</>}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-xs">
                <div className="text-zinc-500">Admin: <span className="text-zinc-400 font-mono">{f.adminWallet}</span></div>
                <div className="text-zinc-500">Treasury: <span className="text-zinc-400 font-mono">{f.treasuryWallet}</span></div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
