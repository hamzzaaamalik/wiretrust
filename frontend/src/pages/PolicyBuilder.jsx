import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Contract, parseEther, formatEther, encodeBytes32String, decodeBytes32String } from 'ethers';
import { useWallet } from '../contexts/WalletContext';
import friendlyError from '../utils/friendlyError';
import GasEstimate from '../components/common/GasEstimate';
import { Lock, Eye, CheckCircle } from 'lucide-react';

const POLICY_ENGINE_ABI = [
  'function setPolicy(uint256 agentId, uint256 maxAmountPerAction, uint256 maxAmountPerDay, uint256 frequencyLimit, uint256 expiry, address[] allowedContracts, bytes32[] allowedActions, uint256 maxActivePositions) external',
  'function getPolicy(uint256 agentId) external view returns (uint256 maxAmountPerAction, uint256 maxAmountPerDay, uint256 frequencyLimit, uint256 expiry, uint256 maxActivePositions, bool active)',
  'function getPolicyContracts(uint256 agentId) external view returns (address[])',
  'function getPolicyActions(uint256 agentId) external view returns (bytes32[])',
];

const ACTION_OPTIONS = [
  { label: 'JOIN_CONTEST', hash: 'JOIN_CONTEST' },
  { label: 'PREDICT', hash: 'PREDICT' },
  { label: 'BUY_NFT', hash: 'BUY_NFT' },
  { label: 'CREATE_AGENT', hash: 'CREATE_AGENT' },
];

export default function PolicyBuilder() {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const { signer, provider, connected } = useWallet();
  const [addresses, setAddresses] = useState(null);

  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(d => setAddresses(d.contracts)).catch(() => {});
  }, []);

  const CONTRACT_OPTIONS = useMemo(() => {
    if (!addresses) return [];
    return [
      { label: 'SquadChallenge', address: addresses.fantasyModule },
      { label: 'PredictionModule', address: addresses.predictionModule },
      { label: 'WireTrustNFT', address: addresses.wireTrustNFT },
    ];
  }, [addresses]);

  const [form, setForm] = useState({
    cooldown: '',
    expiry: '',
    allowedContracts: [],
    allowedActions: [],
    maxPositions: '',
    active: true,
  });
  const [policyLocked, setPolicyLocked] = useState(false);
  const [currentPolicy, setCurrentPolicy] = useState(null);
  const [loadingPolicy, setLoadingPolicy] = useState(false);
  const [txStatus, setTxStatus] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadPolicy() {
      if (!provider || !addresses?.policyEngine) return;
      setLoadingPolicy(true);
      try {
        const contract = new Contract(addresses.policyEngine, POLICY_ENGINE_ABI, provider);
        const result = await contract.getPolicy(agentId);
        const contractsResult = await contract.getPolicyContracts(agentId);
        const actionsResult = await contract.getPolicyActions(agentId);

        const decodedActions = actionsResult.map((a) => {
          try { return decodeBytes32String(a); } catch { return a; }
        }).filter(Boolean);

        const existing = {
          cooldown: result.frequencyLimit.toString(),
          expiry: result.expiry.toString() === '0' ? '' : new Date(Number(result.expiry) * 1000).toISOString().split('T')[0],
          allowedContracts: contractsResult.map((a) => a.toLowerCase()),
          allowedActions: decodedActions,
          maxPositions: result.maxActivePositions.toString(),
          active: result.active,
        };
        setCurrentPolicy(existing);

        // Check if policy is already set on-chain (locked)
        const hasPolicy = existing.cooldown !== '0' || decodedActions.length > 0 || contractsResult.length > 0 || existing.maxPositions !== '0';
        if (hasPolicy) {
          setPolicyLocked(true);
          setForm({
            cooldown: existing.cooldown === '0' ? '' : existing.cooldown,
            expiry: existing.expiry,
            allowedContracts: existing.allowedContracts,
            allowedActions: existing.allowedActions,
            maxPositions: existing.maxPositions === '0' ? '' : existing.maxPositions,
            active: existing.active,
          });
        }
      } catch {
        // No existing policy
      } finally {
        setLoadingPolicy(false);
      }
    }
    loadPolicy();
  }, [provider, agentId, addresses]);

  function handleInput(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function toggleContract(address) {
    if (policyLocked) return;
    setForm((prev) => {
      const lower = address.toLowerCase();
      const exists = prev.allowedContracts.includes(lower);
      return {
        ...prev,
        allowedContracts: exists
          ? prev.allowedContracts.filter((a) => a !== lower)
          : [...prev.allowedContracts, lower],
      };
    });
  }

  function toggleAction(action) {
    if (policyLocked) return;
    setForm((prev) => {
      const exists = prev.allowedActions.includes(action);
      return {
        ...prev,
        allowedActions: exists
          ? prev.allowedActions.filter((a) => a !== action)
          : [...prev.allowedActions, action],
      };
    });
  }

  const policyJson = useMemo(() => {
    const expiryUnix = form.expiry ? Math.floor(new Date(form.expiry).getTime() / 1000) : 0;
    return {
      agentId: Number(agentId),
      cooldown: `${form.cooldown || 0} seconds`,
      expiry: expiryUnix === 0 ? 'No expiry' : `${expiryUnix} (${form.expiry})`,
      allowedContracts: form.allowedContracts,
      allowedActions: form.allowedActions,
      maxPositions: Number(form.maxPositions) || 0,
      active: form.active,
    };
  }, [form, agentId]);

  async function handleSave(e) {
    e.preventDefault();
    if (policyLocked) return;
    if (!connected || !signer) {
      setError('Please connect your wallet first');
      return;
    }

    if (!addresses?.policyEngine) {
      setError('Contract addresses not loaded yet. Please wait and try again.');
      return;
    }

    // Gas balance pre-flight check
    try {
      const addr = await signer.getAddress();
      const bal = await signer.provider.getBalance(addr);
      if (bal < 5000000000000000n) {
        setError('Insufficient WIRE for gas fees. You need at least 0.005 WIRE.');
        return;
      }
    } catch {}

    setError(null);
    setTxStatus('pending');

    try {
      const contract = new Contract(addresses.policyEngine, POLICY_ENGINE_ABI, signer);
      const expiryUnix = form.expiry ? Math.floor(new Date(form.expiry).getTime() / 1000) : 0;
      const actionHashes = form.allowedActions.map((a) => encodeBytes32String(a));

      const tx = await contract.setPolicy(
        agentId,
        parseEther('0'),  // maxAmountPerAction — not used
        parseEther('0'),  // maxAmountPerDay — not used
        Number(form.cooldown) || 0,
        expiryUnix,
        form.allowedContracts,
        actionHashes,
        Number(form.maxPositions) || 0,
        { gasLimit: 500000n, gasPrice: 10000000000n }
      );

      setTxStatus('confirming');
      await tx.wait();
      setTxStatus('success');
      setPolicyLocked(true);

      // Redirect to agent profile after brief success message
      setTimeout(() => navigate(`/agent/${agentId}`), 1800);
    } catch (err) {
      setError(friendlyError(err));
      setTxStatus(null);
    }
  }

  // Locked view — policy already on-chain
  if (policyLocked && !loadingPolicy) {
    return (
      <div className="max-w-3xl mx-auto animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center">
              <Lock className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Policy Locked</h1>
              <p className="text-sm text-zinc-500 mt-0.5">Agent #{agentId} — immutable on WireFluid</p>
            </div>
          </div>
          <button onClick={() => navigate(`/agent/${agentId}`)} className="btn-primary text-sm">
            View Agent Profile
          </button>
        </div>

        <div className="bg-zinc-900/70 border border-emerald-400/10 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            <span>Policy is deployed on-chain and cannot be modified</span>
          </div>

          <div className="h-px bg-zinc-800/60" />

          {/* Timing & Constraints */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-200 tracking-tight mb-4 flex items-center gap-2">
              <Eye className="w-4 h-4 text-zinc-500" />
              Timing & Constraints
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Cooldown', value: `${form.cooldown || '0'} seconds` },
                { label: 'Policy Expiry', value: form.expiry || 'No expiry' },
                { label: 'Max Open Positions', value: form.maxPositions || '0' },
              ].map((item) => (
                <div key={item.label} className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-3">
                  <p className="text-2xs text-zinc-500 uppercase tracking-wider mb-1">{item.label}</p>
                  <p className="text-sm text-zinc-200 font-medium">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="h-px bg-zinc-800/60" />

          {/* Allowed Contracts */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-200 tracking-tight mb-3">Allowed Contracts</h3>
            <div className="flex flex-wrap gap-2">
              {form.allowedContracts.length > 0 ? (
                CONTRACT_OPTIONS.filter(c => form.allowedContracts.includes(c.address?.toLowerCase())).map((c) => (
                  <span key={c.address} className="px-3.5 py-2 rounded-xl text-sm font-medium border bg-primary-light/10 border-primary-light/40 text-primary-light">
                    {c.label}
                  </span>
                ))
              ) : (
                <span className="text-sm text-zinc-600">No contracts specified</span>
              )}
            </div>
          </div>

          {/* Allowed Actions */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-200 tracking-tight mb-3">Allowed Actions</h3>
            <div className="flex flex-wrap gap-2">
              {form.allowedActions.length > 0 ? (
                form.allowedActions.map((a) => (
                  <span key={a} className="px-3.5 py-2 rounded-xl text-sm font-medium border bg-emerald-400/10 border-emerald-400/40 text-emerald-400">
                    {a}
                  </span>
                ))
              ) : (
                <span className="text-sm text-zinc-600">No actions specified</span>
              )}
            </div>
          </div>

          <div className="h-px bg-zinc-800/60" />

          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">Policy Status</span>
            {form.active ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-400 text-2xs font-semibold uppercase tracking-wider bg-emerald-400/10 border border-emerald-400/20 rounded-lg px-2.5 py-1">
                Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-red-400 text-2xs font-semibold uppercase tracking-wider bg-red-400/10 border border-red-400/20 rounded-lg px-2.5 py-1">
                Inactive
              </span>
            )}
          </div>
        </div>

        {/* Policy JSON */}
        <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-zinc-200 tracking-tight mb-4">On-Chain Policy Data</h3>
          <pre className="text-xs text-zinc-400 bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap break-words leading-relaxed">
            {JSON.stringify(policyJson, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  // Editable form — no policy set yet
  return (
    <div className="max-w-5xl mx-auto animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Policy Builder</h1>
          <p className="text-sm text-zinc-500 mt-1">Configure guardrails for Agent #{agentId}</p>
        </div>
        <button onClick={() => navigate(`/agent/${agentId}`)} className="btn-secondary text-sm">
          View Agent
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-zinc-900/70 border border-amber-400/20 rounded-xl px-4 py-3 text-sm text-amber-300 animate-fade-in flex items-start gap-2.5">
        <Lock className="w-4 h-4 shrink-0 mt-0.5" />
        <span>Once submitted, this policy is <strong>locked on-chain</strong> and cannot be changed. Review carefully before deploying.</span>
      </div>

      {/* Wallet prompt */}
      {!connected && (
        <div className="bg-zinc-900/70 border border-amber-400/20 rounded-xl px-4 py-4 text-sm text-amber-300 text-center animate-fade-in">
          Connect your wallet to save policy settings.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Form */}
        <form onSubmit={handleSave} className="lg:col-span-3 bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5 space-y-6">
          {/* Timing & Constraints */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-200 tracking-tight mb-4">Timing & Constraints</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-2xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Cooldown Between Actions</label>
                <div className="relative">
                  <input
                    type="number"
                    name="cooldown"
                    value={form.cooldown}
                    onChange={handleInput}
                    placeholder="60"
                    min="0"
                    className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-white placeholder-zinc-600 text-sm w-full focus:outline-none focus:ring-1 focus:ring-primary-light/50 focus:border-primary-light/50 transition-colors"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-2xs text-zinc-600 font-medium">sec</span>
                </div>
                <p className="text-2xs text-zinc-600 mt-1">Min time between agent actions</p>
              </div>
              <div>
                <label className="block text-2xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Policy Expiry</label>
                <input
                  type="date"
                  name="expiry"
                  value={form.expiry}
                  onChange={handleInput}
                  className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-white placeholder-zinc-600 text-sm w-full focus:outline-none focus:ring-1 focus:ring-primary-light/50 focus:border-primary-light/50 transition-colors [color-scheme:dark]"
                />
                {form.expiry && new Date(form.expiry) < new Date(new Date().toDateString()) && (
                  <p className="text-2xs text-amber-400 mt-1">Warning: this date is in the past</p>
                )}
                <p className="text-2xs text-zinc-600 mt-1">Leave empty for no expiry</p>
              </div>
              <div>
                <label className="block text-2xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Max Active Positions</label>
                <input
                  type="number"
                  name="maxPositions"
                  value={form.maxPositions}
                  onChange={handleInput}
                  placeholder="5"
                  min="0"
                  className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-white placeholder-zinc-600 text-sm w-full focus:outline-none focus:ring-1 focus:ring-primary-light/50 focus:border-primary-light/50 transition-colors"
                />
                <p className="text-2xs text-zinc-600 mt-1">Max predictions/squads at once</p>
              </div>
            </div>
          </div>

          <div className="h-px bg-zinc-800/60" />

          {/* Allowed Contracts */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-200 tracking-tight mb-1.5">Allowed Contracts</h3>
            <p className="text-2xs text-zinc-500 mb-3">Which smart contracts can this agent interact with?</p>
            <div className="flex flex-wrap gap-2">
              {CONTRACT_OPTIONS.map((c) => {
                const selected = form.allowedContracts.includes(c.address.toLowerCase());
                return (
                  <button
                    key={c.address}
                    type="button"
                    onClick={() => toggleContract(c.address)}
                    className={`px-3.5 py-2 rounded-xl text-sm font-medium border transition-all duration-150 ${
                      selected
                        ? 'bg-primary-light/10 border-primary-light/40 text-primary-light shadow-[0_0_8px_rgba(var(--color-primary-light-rgb,99,102,241),0.1)]'
                        : 'bg-zinc-900/50 border-zinc-800/60 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400'
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Allowed Actions */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-200 tracking-tight mb-1.5">Allowed Actions</h3>
            <p className="text-2xs text-zinc-500 mb-3">What actions is this agent authorized to perform?</p>
            <div className="flex flex-wrap gap-2">
              {ACTION_OPTIONS.map((a) => {
                const selected = form.allowedActions.includes(a.hash);
                return (
                  <button
                    key={a.hash}
                    type="button"
                    onClick={() => toggleAction(a.hash)}
                    className={`px-3.5 py-2 rounded-xl text-sm font-medium border transition-all duration-150 ${
                      selected
                        ? 'bg-emerald-400/10 border-emerald-400/40 text-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.1)]'
                        : 'bg-zinc-900/50 border-zinc-800/60 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400'
                    }`}
                  >
                    {a.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-zinc-800/60" />

          {/* Policy Active Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-zinc-200">Policy Active</span>
              <p className="text-2xs text-zinc-600 mt-0.5">Enable or disable this policy</p>
            </div>
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, active: !prev.active }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${form.active ? 'bg-emerald-400' : 'bg-zinc-700'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform duration-200 ${form.active ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Alerts */}
          {error && (
            <div className="flex items-start gap-3 bg-red-400/5 border border-red-400/20 rounded-xl px-4 py-3 text-sm text-red-400 animate-fade-in">
              <span className="shrink-0 mt-0.5">!</span>
              <span>{error}</span>
            </div>
          )}

          {txStatus === 'success' && (
            <div className="flex items-start gap-3 bg-emerald-400/5 border border-emerald-400/20 rounded-xl px-4 py-3 text-sm text-emerald-400 animate-fade-in">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Policy deployed on-chain! Redirecting to agent profile...</span>
            </div>
          )}

          {/* Gas Estimate */}
          <GasEstimate
            provider={signer?.provider}
            fallbackGas={300000n}
            label="Est. Gas Fee"
          />

          {/* Submit */}
          <button
            type="submit"
            disabled={txStatus === 'pending' || txStatus === 'confirming' || txStatus === 'success'}
            className="btn-primary w-full py-3 rounded-xl font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
          >
            {txStatus === 'pending' && 'Sending Transaction...'}
            {txStatus === 'confirming' && 'Confirming on WireFluid...'}
            {txStatus === 'success' && 'Policy Locked! Redirecting...'}
            {txStatus === null && 'Deploy Policy (Permanent)'}
          </button>
        </form>

        {/* Sidebar */}
        <div className="lg:col-span-2 space-y-5">
          {/* Policy Preview */}
          <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-zinc-200 tracking-tight mb-4">Policy Preview</h3>
            <pre className="text-xs text-zinc-400 bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap break-words leading-relaxed">
              {JSON.stringify(policyJson, null, 2)}
            </pre>
          </div>

          {/* Loading indicator */}
          {loadingPolicy && (
            <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5 text-center animate-fade-in">
              <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm text-zinc-400">Loading policy...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
