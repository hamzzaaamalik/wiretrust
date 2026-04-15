import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Contract, parseEther, encodeBytes32String } from 'ethers';
import { Monitor, Shield, Zap, BarChart3, Rocket, CheckCircle, XCircle } from 'lucide-react';
import { useWallet } from '../contexts/WalletContext';
import friendlyError from '../utils/friendlyError';
import PageGuide from '../components/common/PageGuide';
import GasEstimate from '../components/common/GasEstimate';

const AGENT_REGISTRY_ABI = [
  'function createAgent(string name, string botType, uint256 franchiseId) external returns (uint256)',
  'event AgentCreated(uint256 indexed agentId, address indexed owner, string name, string botType, uint256 indexed franchiseId, uint256 timestamp)',
];

const POLICY_ENGINE_ABI = [
  'function setPolicy(uint256 agentId, uint256 maxAmountPerAction, uint256 maxAmountPerDay, uint256 frequencyLimit, uint256 expiry, address[] allowedContracts, bytes32[] allowedActions, uint256 maxActivePositions) external',
];

// Pre-built agent templates — one click deploy with safe defaults
const TEMPLATES = [
  {
    id: 'prediction',
    name: 'Prediction Bot',
    botType: 'PREDICTION',
    icon: '🎯',
    desc: 'Predicts match winners, top scorers and total runs using 6-factor AI analysis.',
    actions: ['PREDICT'],
    contractKeys: ['predictionModule'],
  },
  {
    id: 'squad',
    name: 'Squad Builder',
    botType: 'FANTASY',
    icon: '⚡',
    desc: 'Builds optimal squads using EWMA form data and player-vs-team matchups.',
    actions: ['JOIN_CONTEST'],
    contractKeys: ['fantasyModule'],
  },
  {
    id: 'multi',
    name: 'Multi Agent',
    botType: 'MULTI',
    icon: '🤖',
    desc: 'Predicts matches AND builds squads. The all-in-one AI agent for full fan engagement.',
    actions: ['PREDICT', 'JOIN_CONTEST'],
    contractKeys: ['predictionModule', 'fantasyModule'],
  },
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
  const { signer, connected, address } = useWallet();
  const [form, setForm] = useState({ name: '', botType: 'FANTASY', franchiseId: 1 });
  const [txStatus, setTxStatus] = useState(null);
  const [error, setError] = useState(null);
  const [addresses, setAddresses] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(true);

  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(d => setAddresses(d.contracts)).catch(() => {});
  }, []);

  // Check agent unlock eligibility (reads on-chain, no backend call)
  useEffect(() => {
    if (!connected || !address || !addresses) { setEligibilityLoading(false); return; }
    setEligibilityLoading(true);

    async function check() {
      try {
        const predModule = new Contract(addresses.predictionModule, [
          'function getUserStats(address) view returns (uint256 totalPoints, uint256 totalCorrect, uint256 totalPredictions, uint256 currentStreak)',
        ], signer || undefined);
        const agentReg = new Contract(addresses.agentRegistry, [
          'function getAgentsByOwner(address) view returns (uint256[])',
        ], signer || undefined);

        const [stats, ownedAgents] = await Promise.all([
          predModule.getUserStats(address),
          agentReg.getAgentsByOwner(address),
        ]);

        const totalPredictions = Number(stats.totalPredictions || stats[2] || 0);
        const totalPoints = Number(stats.totalPoints || stats[0] || 0);
        const agentCount = ownedAgents.length;

        // Squad check: see if user joined any contest (check first 20)
        let squadsJoined = 0;
        try {
          const fantasy = new Contract(addresses.fantasyModule, [
            'function contestCount() view returns (uint256)',
            'function getSquad(uint256, address) view returns (address owner, uint256 captainId, uint256 viceCaptainId, uint256 totalCredits, uint256 submittedAt, uint256 totalPoints, uint256[11] playerIds)',
          ], signer || undefined);
          const count = Number(await fantasy.contestCount());
          for (let i = 1; i <= Math.min(count, 20); i++) {
            try {
              const squad = await fantasy.getSquad(i, address);
              if (squad.owner && squad.owner !== '0x0000000000000000000000000000000000000000') { squadsJoined++; break; }
            } catch {}
          }
        } catch {}

        const requirements = {
          predictions: { required: 5, current: totalPredictions, met: totalPredictions >= 5 },
          squads: { required: 1, current: squadsJoined, met: squadsJoined >= 1 },
          points: { required: 100, current: totalPoints, met: totalPoints >= 100 },
          agentLimit: { max: 1, current: agentCount, met: agentCount < 1 },
        };
        const eligible = requirements.predictions.met && requirements.squads.met && requirements.points.met && requirements.agentLimit.met;
        setEligibility({ eligible, requirements, agentCount });
      } catch {
        setEligibility(null); // fail open - show deploy options
      }
      setEligibilityLoading(false);
    }
    check();
  }, [connected, address, addresses, signer]);

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

  // Quick Deploy: creates agent + sets policy + starts it in one flow
  async function handleQuickDeploy(template) {
    if (!connected || !signer || !addresses?.agentRegistry || !addresses?.policyEngine) {
      setError('Please connect your wallet and wait for contracts to load');
      return;
    }

    try {
      const addr = await signer.getAddress();
      const bal = await signer.provider.getBalance(addr);
      if (bal < 10000000000000000n) {
        setError('Need at least 0.01 WIRE for Quick Deploy (2 transactions)');
        return;
      }
    } catch {}

    setError(null);
    setTxStatus('pending');

    try {
      // Step 1: Create agent
      const registry = new Contract(addresses.agentRegistry, AGENT_REGISTRY_ABI, signer);
      const agentName = `${template.name}-${Date.now().toString(36).slice(-4)}`;
      const tx1 = await registry.createAgent(agentName, template.botType, 1, {
        gasLimit: 500000n, gasPrice: 10000000000n,
      });
      setTxStatus('confirming');
      const receipt1 = await tx1.wait();

      const createdEvent = receipt1.logs
        .map((log) => { try { return registry.interface.parseLog(log); } catch { return null; } })
        .find((p) => p?.name === 'AgentCreated');
      const agentId = createdEvent?.args?.agentId?.toString();
      if (!agentId) throw new Error('Agent creation failed');

      // Step 2: Set policy with safe defaults
      setTxStatus('Setting policy...');
      const policyEngine = new Contract(addresses.policyEngine, POLICY_ENGINE_ABI, signer);
      const allowedContracts = template.contractKeys.map((k) => addresses[k]).filter(Boolean);
      const allowedActions = template.actions.map((a) => encodeBytes32String(a));
      const expiry = Math.floor(Date.now() / 1000) + 90 * 86400; // 90 days

      const tx2 = await policyEngine.setPolicy(
        agentId,
        parseEther('0.5'),   // maxAmountPerAction
        parseEther('2'),     // maxAmountPerDay
        30,                  // frequencyLimit (30 seconds)
        expiry,
        allowedContracts,
        allowedActions,
        50,                  // maxActivePositions
        { gasLimit: 500000n, gasPrice: 10000000000n }
      );
      await tx2.wait();

      // Step 3: Auto-start the agent via backend
      setTxStatus('Starting agent...');
      try {
        await fetch(`/api/agents/auto/${agentId}/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'x-wallet-address': addr },
          body: JSON.stringify({ botType: template.botType, intervalSeconds: 60 }),
        });
      } catch {} // non-critical if backend start fails

      setTxStatus('success');
      setTimeout(() => navigate(`/agent/${agentId}`), 1500);
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

      {/* ═══ ELIGIBILITY LOADING ═══ */}
      {connected && eligibilityLoading && (
        <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-6 animate-pulse">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-zinc-800" />
            <div className="space-y-2">
              <div className="h-4 w-40 bg-zinc-800 rounded" />
              <div className="h-3 w-56 bg-zinc-800/60 rounded" />
            </div>
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-zinc-800" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-32 bg-zinc-800 rounded" />
                  <div className="h-1.5 bg-zinc-800 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ ELIGIBILITY CHECK ═══ */}
      {connected && !eligibilityLoading && eligibility?.requirements && !eligibility.eligible && (
        <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-6 animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Shield size={20} className="text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Unlock AI Agents</h3>
              <p className="text-2xs text-zinc-500">Complete these milestones to deploy your first agent</p>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Make 5 predictions', current: eligibility.requirements.predictions.current, required: eligibility.requirements.predictions.required, met: eligibility.requirements.predictions.met, link: '/predict' },
              { label: 'Join 1 squad challenge', current: eligibility.requirements.squads.current, required: eligibility.requirements.squads.required, met: eligibility.requirements.squads.met, link: '/squad-challenge' },
              { label: 'Earn 100 prediction points', current: eligibility.requirements.points.current, required: eligibility.requirements.points.required, met: eligibility.requirements.points.met, link: '/predict' },
            ].map((req) => (
              <div key={req.label} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${req.met ? 'bg-emerald-500/20' : 'bg-zinc-800'}`}>
                  {req.met
                    ? <CheckCircle size={14} className="text-emerald-400" />
                    : <span className="text-2xs font-bold text-zinc-500">{Math.min(Math.round((req.current / req.required) * 100), 99)}%</span>
                  }
                </div>
                <div className="flex-1">
                  <p className={`text-xs font-medium ${req.met ? 'text-emerald-400' : 'text-zinc-400'}`}>{req.label}</p>
                  <div className="mt-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${req.met ? 'bg-emerald-500' : 'bg-primary'}`}
                      style={{ width: `${Math.min((req.current / req.required) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-2xs text-zinc-600 mt-0.5">{req.current} / {req.required}</p>
                </div>
                {!req.met && (
                  <Link to={req.link} className="text-2xs text-primary-light hover:text-primary font-medium">Go</Link>
                )}
              </div>
            ))}
            {!eligibility.requirements.agentLimit.met && (
              <div className="flex items-center gap-3 pt-2 border-t border-zinc-800/40">
                <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                  <XCircle size={14} className="text-red-400" />
                </div>
                <p className="text-xs text-red-400">You already have 1 agent (maximum reached)</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ QUICK DEPLOY ═══ */}
      {(!eligibility || eligibility.eligible) && (<>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Rocket size={16} className="text-secondary" />
          <h2 className="text-sm font-semibold text-white">Quick Deploy</h2>
          <span className="text-2xs text-zinc-500">One-click setup with safe defaults</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => handleQuickDeploy(t)}
              disabled={isSubmitting || !connected}
              className="group text-left bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-4
                         hover:border-secondary/40 hover:bg-secondary/[0.03] transition-all duration-200
                         disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <div className="text-2xl mb-2">{t.icon}</div>
              <h3 className="text-sm font-semibold text-white group-hover:text-secondary transition-colors">{t.name}</h3>
              <p className="text-2xs text-zinc-500 leading-relaxed mt-1">{t.desc}</p>
              <div className="mt-3 flex items-center gap-1 text-2xs text-zinc-600 group-hover:text-secondary/70 transition-colors">
                <Zap size={10} /> Creates + configures + starts in one click
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-zinc-800/60" />
        <span className="text-2xs text-zinc-600 uppercase tracking-wider">or configure manually</span>
        <div className="flex-1 h-px bg-zinc-800/60" />
      </div>
      </>)}

      <PageGuide
        id="agents"
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

      {/* ── Manual form (also gated by eligibility) ── */}
      {(!eligibility || eligibility.eligible) && (
      <>
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
      </>
      )}
    </div>
  );
}
