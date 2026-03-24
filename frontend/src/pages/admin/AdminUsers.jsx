import { useState, useEffect } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { Link } from 'react-router-dom';
import { UserCog, Droplets, ExternalLink, Search, Copy, CheckCircle2 } from 'lucide-react';
import Pagination from '../../components/ui/Pagination';

const H = (addr) => ({ 'x-wallet-address': addr || '' });

export default function AdminUsers() {
  const { address } = useWallet();
  const [users, setUsers] = useState([]);
  const [faucet, setFaucet] = useState([]);
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [faucetPage, setFaucetPage] = useState(1);
  const [faucetTotalPages, setFaucetTotalPages] = useState(1);

  useEffect(() => {
    const userParams = new URLSearchParams({ page, limit: 25 });
    if (search) userParams.set('search', search);
    const faucetParams = new URLSearchParams({ page: faucetPage, limit: 25 });

    Promise.all([
      fetch(`/api/admin/users?${userParams}`, { headers: H(address) }).then(r => r.json()),
      fetch(`/api/admin/faucet-history?${faucetParams}`, { headers: H(address) }).then(r => r.json()),
    ])
      .then(([u, f]) => {
        setUsers(Array.isArray(u) ? u : (u.rows || []));
        setTotalPages(u.totalPages || 1);
        setFaucet(Array.isArray(f) ? f : (f.rows || []));
        setFaucetTotalPages(f.totalPages || 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [address, page, search, faucetPage]);

  function copyAddr(addr) {
    navigator.clipboard.writeText(addr);
    setCopied(addr);
    setTimeout(() => setCopied(null), 2000);
  }

  const filteredUsers = users;
  const filteredFaucet = faucet;

  const totalFunded = users.filter(u => u.funded).length;
  const totalWire = faucet.reduce((sum, f) => sum + Number(f.amount || 0), 0);

  if (loading) return <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-zinc-900/70 rounded-2xl animate-pulse" />)}</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><UserCog size={22} className="text-purple-400" /> Users</h1>
        <p className="text-sm text-zinc-500 mt-1">{users.length} registered · {totalFunded} funded · {totalWire.toLocaleString()} WIRE distributed</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Users', value: users.length, color: 'text-purple-400' },
          { label: 'Funded', value: totalFunded, color: 'text-emerald-400' },
          { label: 'Faucet Drips', value: faucet.length, color: 'text-blue-400' },
          { label: 'WIRE Distributed', value: `${totalWire.toLocaleString()}`, color: 'text-accent' },
        ].map(s => (
          <div key={s.label} className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-3">
            <div className="text-2xs text-zinc-500 uppercase font-medium">{s.label}</div>
            <div className={`text-lg font-bold ${s.color} mt-0.5`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-zinc-900/50 rounded-xl p-1">
          {['Users', 'Faucet History'].map((t, i) => (
            <button key={t} onClick={() => setTab(i)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === i ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'}`}>
              {t} ({i === 0 ? users.length : faucet.length})
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by address..." className="input pl-9 w-full" />
        </div>
      </div>

      {tab === 0 && (<>
        <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="text-zinc-500 text-left border-b border-zinc-800">
              <th className="px-4 py-3 font-medium">Address</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Funded</th>
              <th className="px-4 py-3 font-medium">Faucet</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium w-20">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filteredUsers.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-zinc-500">{search ? 'No matching users' : 'No users registered yet'}</td></tr>
              ) : filteredUsers.map(u => (
                <tr key={u.address} className="hover:bg-zinc-800/30">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs text-zinc-400">{u.address.slice(0, 6)}...{u.address.slice(-4)}</span>
                      <button onClick={() => copyAddr(u.address)} className="text-zinc-600 hover:text-white transition-colors" title="Copy address">
                        {copied === u.address ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2.5"><span className="px-2 py-0.5 rounded-full text-2xs font-medium bg-zinc-800 text-zinc-400">{u.wallet_type}</span></td>
                  <td className="px-4 py-2.5">{u.funded ? <span className="text-emerald-400 text-2xs font-medium">Yes</span> : <span className="text-zinc-600 text-2xs">No</span>}</td>
                  <td className="px-4 py-2.5 text-zinc-400 text-xs">{u.faucet_count}x</td>
                  <td className="px-4 py-2.5 text-zinc-500 text-xs">{new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td className="px-4 py-2.5">
                    <Link to={`/fan/${u.address}`} className="text-zinc-600 hover:text-primary-light transition-colors flex items-center gap-1 text-xs">
                      <ExternalLink size={12} /> View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-4" />
      </>)}

      {tab === 1 && (<>
        <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="text-zinc-500 text-left border-b border-zinc-800">
              <th className="px-4 py-3 font-medium">Address</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Tx Hash</th>
              <th className="px-4 py-3 font-medium">Time</th>
            </tr></thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filteredFaucet.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-zinc-500">{search ? 'No matching faucet activity' : 'No faucet activity yet'}</td></tr>
              ) : filteredFaucet.map(f => (
                <tr key={f.id} className="hover:bg-zinc-800/30">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs text-zinc-400">{f.address.slice(0, 6)}...{f.address.slice(-4)}</span>
                      <button onClick={() => copyAddr(f.address)} className="text-zinc-600 hover:text-white transition-colors">
                        {copied === f.address ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-accent font-medium text-xs">{f.amount} WIRE</td>
                  <td className="px-4 py-2.5 font-mono text-2xs text-zinc-500">{f.tx_hash ? `${f.tx_hash.slice(0, 10)}...${f.tx_hash.slice(-4)}` : '-'}</td>
                  <td className="px-4 py-2.5 text-zinc-500 text-xs">{new Date(f.funded_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={faucetPage} totalPages={faucetTotalPages} onPageChange={setFaucetPage} className="mt-4" />
      </>)}
    </div>
  );
}
