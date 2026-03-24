import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Contract } from 'ethers';
import { Monitor, Shield, Zap, BarChart3 } from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';
import friendlyError from '../utils/friendlyError';
import PageGuide from '../components/common/PageGuide';
import GasEstimate from '../components/common/GasEstimate';

const AGENT_REGISTRY_ABI = [
  'function createAgent(string name, string botType, uint256 franchiseId) external returns (uint256)',
  'event AgentCreated(uint256 indexed agentId, address indexed owner, string name, string botType, uint256 indexed franchiseId, uint256 timestamp)',
];

const BOT_TYPES = [
  { value: 'FANTASY', label: 'SQUAD', description: 'Automates squad selection and contest entry based on player form, matchups and credit budgets.' },
  { value: 'PREDICTION', label: 'PREDICTION', description: 'Makes match predictions using historical data. Earns reputation points for accuracy and streaks.' },
  { value: 'EXPERIENCE', label: 'EXPERIENCE', description: 'Collects NFT rewards and completes fan challenges. Builds a curated collection of cricket moments.' },
  { value: 'MULTI', label: 'MULTI', description: 'Combines squad, prediction and experience capabilities. One agent for all fan engagement activities.' },
];

const FRANCHISES = [
  { id: 1, name: 'The Pindiz' },
];

export default function CreateAgent() {
  const navigate = useNavigate();
  const { signer, connected } = useWallet();
  const [form, setForm] = useState({ name: '', botType: 'FANTASY', franchiseId: 1 });
  const [txStatus, setTxStatus] = useState(null);
  const [error, setError] = useState(null);
  const [addresses, setAddresses] = useState(null);

  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(d => setAddresses(d.contracts)).catch(() => {});
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === 'franchiseId' ? Number(value) : value,
    }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!connected || !signer) {
      setError('Please connect your wallet first');
      return;
    }
    if (!form.name.trim()) {
      setError('Agent name is required');
      return;
    }

    if (!addresses?.agentRegistry) {
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
      const contract = new Contract(addresses.agentRegistry, AGENT_REGISTRY_ABI, signer);
      const tx = await contract.createAgent(form.name, form.botType, form.franchiseId, {
        gasLimit: 500000n,
        gasPrice: 10000000000n, // 10 Gwei - WireFluid minimum
      });
      setTxStatus('confirming');
      const receipt = await tx.wait();

      const agentCreatedEvent = receipt.logs
        .map((log) => {
          try { return contract.interface.parseLog(log); } catch { return null; }
        })
        .find((parsed) => parsed?.name === 'AgentCreated');

      setTxStatus('success');
      const newAgentId = agentCreatedEvent ? agentCreatedEvent.args.agentId.toString() : null;
      setTimeout(() => navigate(newAgentId ? `/policy/${newAgentId}` : '/agents'), 1500);
    } catch (err) {
      setError(friendlyError(err));
      setTxStatus(null);
    }
  }

  const selectedType = BOT_TYPES.find((t) => t.value === form.botType);
  const isSubmitting = txStatus !== null;

  return (
    <div className="max-w-2xl mx-auto animate-fade-in space-y-5">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Create Agent</h1>
        <p className="text-zinc-400 text-sm mt-1.5 leading-relaxed">
          Deploy an autonomous AI agent to compete in squad challenges, predict outcomes and collect NFTs.
        </p>
      </div>

      <PageGuide
        title="What Are AI Agents?"
        steps={[
          { icon: Monitor, title: 'Deploy an Agent', desc: 'Create an autonomous AI agent registered on WireFluid. It acts on your behalf in squad contests, predictions and NFT collection.' },
          { icon: Shield, title: 'Set Policy Guardrails', desc: 'Configure 8 smart contract checks: spending limits, daily caps, cooldowns, allowed contracts, action whitelist and more.' },
          { icon: Zap, title: 'Execute Actions', desc: 'Every agent action routes through the ExecutionGateway. Policy violations are caught and logged before execution.' },
          { icon: BarChart3, title: 'Build On-Chain Reputation', desc: 'Successful actions increase your score (0-100). Failed attempts and violations are recorded permanently as a trust fingerprint.' },
        ]}
        tips={[
          'Agent types: SQUAD (contest entry), PREDICTION (match calls), EXPERIENCE (NFT collection), MULTI (all combined).',
          'New agents start at score 50 (MEDIUM). Consistent success pushes toward SAFE (70+). Violations drop toward RISKY (<40).',
          'Attempted violations are logged on-chain even when the action is blocked. This is what makes WireTrust unique.',
          'Deploy multiple agents with different strategies. Each has its own independent reputation.',
        ]}
      />

      {/* ── Wallet prompt ── */}
      {!connected && (
        <div className="bg-zinc-900/70 border border-amber-400/20 rounded-xl px-4 py-4 mb-5 text-sm text-amber-300 text-center animate-fade-in">
          Connect your wallet to create an agent.
        </div>
      )}

      {/* ── Form Card ── */}
      <form
        onSubmit={handleCreate}
        className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5 space-y-5 animate-fade-in-up"
      >

        {/* Agent Name */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            Agent Name
          </label>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="e.g. CricketMaster_v1"
            className="input-field"
            maxLength={32}
            disabled={isSubmitting}
          />
          <p className="text-2xs text-zinc-500 mt-1.5">
            {form.name.length}/32 characters
          </p>
        </div>

        <div className="divider h-px bg-zinc-800/60" />

        {/* Agent Type */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            Agent Type
          </label>
          <select
            name="botType"
            value={form.botType}
            onChange={handleChange}
            className="input-field"
            disabled={isSubmitting}
          >
            {BOT_TYPES.map((bt) => (
              <option key={bt.value} value={bt.value}>{bt.label}</option>
            ))}
          </select>

          {selectedType && (
            <div className="card-surface mt-2.5">
              <div className="flex items-start gap-2.5">
                <div className="shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full bg-indigo-400" />
                <p className="text-sm text-zinc-400 leading-relaxed">
                  {selectedType.description}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="divider h-px bg-zinc-800/60" />

        {/* Franchise */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            Franchise
          </label>
          <select
            name="franchiseId"
            value={form.franchiseId}
            onChange={handleChange}
            className="input-field"
            disabled={isSubmitting}
          >
            {FRANCHISES.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="alert-error">
            <svg className="shrink-0 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Gas Estimate */}
        <GasEstimate
          provider={signer?.provider}
          fallbackGas={250000n}
          label="Est. Gas Fee"
        />

        {/* Submit */}
        <button
          type="submit"
          disabled={txStatus !== null}
          className="btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {txStatus === null && 'Create Agent'}
          {txStatus === 'pending' && 'Sending Transaction...'}
          {txStatus === 'confirming' && 'Confirming on WireFluid...'}
          {txStatus === 'success' && (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Agent Created! Redirecting...
            </span>
          )}
        </button>
      </form>

      {/* ── Transaction Modal Overlay ── */}
      {txStatus && txStatus !== 'success' && (
        <div className="modal-backdrop">
          <div className="modal-content text-center">
            <div className="animate-spin w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-5" />
            <h3 className="text-lg font-semibold text-white mb-2">
              {txStatus === 'pending' ? 'Awaiting Confirmation' : 'Processing Transaction'}
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {txStatus === 'pending'
                ? 'Please confirm the transaction in your wallet.'
                : 'Waiting for the WireFluid network to confirm...'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
