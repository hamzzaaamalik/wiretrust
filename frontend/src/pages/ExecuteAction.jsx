import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Contract, Interface, parseEther, encodeBytes32String, hexlify, randomBytes } from 'ethers';
import { useWallet } from '../contexts/WalletContext';
import { ChevronRight, CheckCircle, Ban, AlertTriangle } from 'lucide-react';
import friendlyError from '../utils/friendlyError';
import GasEstimate from '../components/common/GasEstimate';

const ZERO = '0x0000000000000000000000000000000000000000';

// ABI fragments for encoding calldata to target modules
const PREDICTION_IFACE = new Interface([
  'function createPrediction(uint256 franchiseId, uint256 matchId, bytes32 predictionType, bytes32 predictedOutcome) external returns (uint256)',
]);
const FANTASY_IFACE = new Interface([
  'function joinContest(uint256 contestId, uint256[11] playerIds, uint256 captainId, uint256 viceCaptainId, uint256 totalCredits) external',
]);
const NFT_IFACE = new Interface([
  'function mint(address to, uint256 franchiseId, uint8 category, string name, string description, string metadataURI, uint256 facePrice, uint256 eventTimestamp) external returns (uint256)',
]);

const POLICY_ENGINE_ABI = [
  'function getPolicy(uint256 agentId) external view returns (uint256 maxAmountPerAction, uint256 maxAmountPerDay, uint256 frequencyLimit, uint256 expiry, uint256 maxActivePositions, bool active)',
];

const EXECUTION_GATEWAY_ABI = [
  'function execute(uint256 agentId, address target, bytes32 action, bytes calldata data, uint256 amount, bytes32 nonce) external payable returns (bool)',
  'event AgentExecuted(uint256 indexed agentId, bytes32 action, bool success, uint256 gasUsed, uint256 timestamp)',
  'event AgentViolation(uint256 indexed agentId, address target, bytes32 action, string reason, uint256 timestamp)',
];

export default function ExecuteAction() {
  const { agentId } = useParams();
  const { signer, connected } = useWallet();

  const [selectedAction, setSelectedAction] = useState('JOIN_CONTEST');
  const [amount, setAmount] = useState('');
  const [dataInput, setDataInput] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState(null);
  const [txStatus, setTxStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [hasSimulated, setHasSimulated] = useState(false);
  const [policyWarning, setPolicyWarning] = useState(null);

  // Action-specific parameters
  const [matches, setMatches] = useState([]);
  const [contests, setContests] = useState([]);
  const [players, setPlayers] = useState([]);

  // PREDICT params
  const [predMatchId, setPredMatchId] = useState('');
  const [predType, setPredType] = useState('MATCH_WINNER');
  const [predOutcome, setPredOutcome] = useState('');

  // JOIN_CONTEST params
  const [contestId, setContestId] = useState('');
  const [squadPlayerIds, setSquadPlayerIds] = useState(Array(11).fill(''));
  const [captainId, setCaptainId] = useState('');
  const [viceCaptainId, setViceCaptainId] = useState('');

  const [addresses, setAddresses] = useState({
    executionGateway: ZERO,
    fantasyModule: ZERO,
    predictionModule: ZERO,
    nft: ZERO,
  });

  useEffect(() => {
    let cancelled = false;
    async function fetchAddresses() {
      try {
        const res = await fetch('/api/health');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const c = data.contracts || {};
        setAddresses({
          executionGateway: c.executionGateway || ZERO,
          fantasyModule: c.fantasyModule || ZERO,
          predictionModule: c.predictionModule || ZERO,
          nft: c.wireTrustNFT || ZERO,
        });
      } catch {
        // keep env/fallback addresses
      }
    }
    fetchAddresses();
    return () => { cancelled = true; };
  }, []);

  // Check policy status (expired / inactive)
  useEffect(() => {
    async function checkPolicy() {
      if (!addresses.executionGateway || addresses.executionGateway === ZERO) return;
      try {
        const res = await fetch('/api/health');
        const data = await res.json();
        const peAddr = data.contracts?.policyEngine;
        if (!peAddr) return;

        const { JsonRpcProvider, Contract } = await import('ethers');
        const provider = new JsonRpcProvider('https://evm.wirefluid.com');
        const pe = new Contract(peAddr, POLICY_ENGINE_ABI, provider);
        const policy = await pe.getPolicy(agentId);

        if (!policy.active) {
          setPolicyWarning('Policy is inactive. The agent cannot execute actions until the policy is activated.');
        } else if (Number(policy.expiry) > 0 && Date.now() / 1000 > Number(policy.expiry)) {
          setPolicyWarning('Policy has expired. Update the expiry date in Policy Builder before executing.');
        } else {
          setPolicyWarning(null);
        }
      } catch {
        // Non-critical - on-chain validation will still catch it
      }
    }
    checkPolicy();
  }, [agentId, addresses]);

  // Load matches
  useEffect(() => {
    async function loadMatches() {
      try {
        const res = await fetch('/api/matches/schedule');
        if (res.ok) {
          const data = await res.json();
          setMatches(data || []);
          if (data?.length > 0) setPredMatchId(String(data[0].matchId));
        }
      } catch {}
    }
    loadMatches();
  }, []);

  // Load match-specific players when match changes
  useEffect(() => {
    if (!predMatchId) return;
    async function loadPlayers() {
      try {
        // Try match-specific players first
        const res = await fetch(`/api/matches/players/${predMatchId}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.length > 0) { setPlayers(data); return; }
        }
        // Fallback to all players
        const allRes = await fetch('/api/matches/players');
        if (allRes.ok) setPlayers(await allRes.json());
      } catch {}
    }
    loadPlayers();
    // Reset squad when match changes
    setSquadPlayerIds(Array(11).fill(''));
    setCaptainId('');
    setViceCaptainId('');
  }, [predMatchId]);

  // Load contests when JOIN_CONTEST is selected
  useEffect(() => {
    if (selectedAction !== 'JOIN_CONTEST' || !predMatchId) return;
    async function loadContests() {
      try {
        const res = await fetch(`/api/fantasy/contests/${predMatchId}`);
        if (res.ok) {
          const data = await res.json();
          setContests(data || []);
          if (data?.length > 0) setContestId(String(data[0].contestId));
        }
      } catch {}
    }
    loadContests();
  }, [selectedAction, predMatchId]);

  // Build calldata based on selected action and parameters
  function buildCalldata() {
    try {
      if (showAdvanced && dataInput && dataInput !== '0x' && dataInput.length > 2) {
        return dataInput; // User manually entered calldata
      }

      if (selectedAction === 'PREDICT') {
        if (!predMatchId || !predOutcome) return null;
        return PREDICTION_IFACE.encodeFunctionData('createPrediction', [
          1, // franchiseId (The Pindiz)
          BigInt(predMatchId),
          encodeBytes32String(predType),
          encodeBytes32String(predOutcome),
        ]);
      }

      if (selectedAction === 'JOIN_CONTEST') {
        if (!contestId) return null;
        const ids = squadPlayerIds.map(id => BigInt(id || 0));
        const hasSquad = ids.some(id => id > 0n);
        if (!hasSquad) return null;
        const cap = BigInt(captainId || ids.find(id => id > 0n) || 0);
        const vc = BigInt(viceCaptainId || ids.find(id => id > 0n && id !== cap) || 0);
        const totalCredits = ids.reduce((sum, id) => {
          const p = players.find(p => String(p.id) === String(id));
          return sum + BigInt(Math.round((p?.credits || 7) * 10));
        }, 0n) / 10n;
        return FANTASY_IFACE.encodeFunctionData('joinContest', [
          BigInt(contestId),
          ids,
          cap,
          vc,
          totalCredits,
        ]);
      }

      // BUY_NFT - mint is admin-only; for demo, just send value with empty data
      return '0x';
    } catch (e) {
      console.warn('Calldata encoding error:', e);
      return null;
    }
  }

  const ACTION_OPTIONS = useMemo(() => [
    { value: 'JOIN_CONTEST', label: 'Join Squad Challenge', target: addresses.fantasyModule, requiresAmount: false },
    { value: 'PREDICT', label: 'Make Prediction', target: addresses.predictionModule, requiresAmount: false },
    { value: 'BUY_NFT', label: 'Buy NFT', target: addresses.nft, requiresAmount: true },
  ], [addresses]);

  const actionConfig = ACTION_OPTIONS.find((a) => a.value === selectedAction);
  const nonceRef = useRef(hexlify(randomBytes(32)));
  const nonce = nonceRef.current;

  async function handleSimulate() {
    setSimulating(true);
    setSimulationResult(null);
    try {
      let amountWei = '0';
      if (actionConfig.requiresAmount && amount) {
        try {
          amountWei = parseEther(amount).toString();
        } catch {
          setSimulationResult({ willSucceed: false, error: 'Invalid amount format' });
          setSimulating(false);
          return;
        }
      }
      const res = await fetch('/api/agents/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          target: actionConfig.target,
          action: selectedAction,
          amount: amountWei,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSimulationResult({
        willSucceed: data.willSucceed,
        estimatedGas: data.estimatedGas,
        policyCheck: data.policyCheck,
        reputationImpact: data.reputationImpact,
        reason: data.reason,
        currentScore: data.currentScore,
        estimatedScoreAfter: data.estimatedScoreAfter,
      });
    } catch {
      setSimulationResult({ willSucceed: false, error: 'Simulation failed' });
    } finally {
      setSimulating(false);
      setHasSimulated(true);
    }
  }

  async function handleExecute() {
    if (!connected || !signer) {
      setError('Please connect your wallet first');
      return;
    }

    if (!hasSimulated) {
      setError('Please run a simulation first to preview the outcome.');
      return;
    }

    if (!addresses?.executionGateway) {
      setError('Loading contract addresses. Please try again in a moment.');
      return;
    }

    if (actionConfig.requiresAmount && !amount) {
      setError('Please enter an amount for this action.');
      return;
    }

    // Gas balance pre-flight check
    try {
      const addr = await signer.getAddress();
      const bal = await signer.provider.getBalance(addr);
      const minGas = 5000000000000000n; // 0.005 WIRE minimum for gas
      if (bal < minGas) {
        setError('Insufficient WIRE for gas fees. You need at least 0.005 WIRE to cover transaction costs.');
        return;
      }
    } catch {
      // If balance check fails, let the tx attempt proceed
    }

    setError(null);
    setResult(null);
    setTxStatus('pending');

    try {
      const contract = new Contract(addresses.executionGateway, EXECUTION_GATEWAY_ABI, signer);
      const actionHash = encodeBytes32String(selectedAction);
      let amountWei = 0n;
      if (actionConfig.requiresAmount && amount) {
        try {
          amountWei = parseEther(amount);
        } catch {
          setError('Invalid amount format');
          setTxStatus(null);
          return;
        }
      }
      const callData = buildCalldata() || '0x';

      const tx = await contract.execute(
        agentId,
        actionConfig.target,
        actionHash,
        callData,
        amountWei,
        nonce,
        { value: amountWei, gasLimit: 800000n, gasPrice: 10000000000n }
      );

      setTxStatus('confirming');
      const receipt = await tx.wait();

      const executedEvent = receipt.logs
        .map((log) => {
          try { return contract.interface.parseLog(log); } catch { return null; }
        })
        .find((parsed) => parsed?.name === 'AgentExecuted');

      const violationEvent = receipt.logs
        .map((log) => {
          try { return contract.interface.parseLog(log); } catch { return null; }
        })
        .find((parsed) => parsed?.name === 'AgentViolation');

      if (violationEvent) {
        setResult({
          type: 'blocked',
          reason: violationEvent.args.reason,
          txHash: receipt.hash,
        });
      } else if (executedEvent && !executedEvent.args.success) {
        setResult({
          type: 'failed',
          gasUsed: executedEvent.args.gasUsed.toString(),
          txHash: receipt.hash,
        });
      } else {
        setResult({
          type: 'success',
          gasUsed: executedEvent ? executedEvent.args.gasUsed.toString() : 'N/A',
          txHash: receipt.hash,
        });
      }
      // Generate new nonce for next execution
      nonceRef.current = hexlify(randomBytes(32));
      setTxStatus(null);
    } catch (err) {
      setError(friendlyError(err));
      setTxStatus(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Execute Action</h1>
          <p className="text-sm text-zinc-500 mt-1">Agent #{agentId}</p>
        </div>
        <Link to={`/agent/${agentId}`} className="btn-secondary text-sm">
          View Agent
        </Link>
      </div>

      {/* Wallet prompt */}
      {!connected && (
        <div className="bg-zinc-900/70 border border-amber-400/20 rounded-xl px-4 py-4 text-center animate-fade-in">
          <p className="text-sm text-amber-300">Connect your wallet to execute actions.</p>
        </div>
      )}

      {/* Policy Warning */}
      {policyWarning && (
        <div className="flex items-start gap-3 bg-amber-400/5 border border-amber-400/20 rounded-xl px-4 py-3 text-sm text-amber-400 animate-fade-in">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <div>
            <span>{policyWarning}</span>
            <Link to={`/policy/${agentId}`} className="ml-2 underline hover:text-amber-300 transition-colors">
              Edit Policy
            </Link>
          </div>
        </div>
      )}

      {/* Main Card */}
      <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5 space-y-6">
        {/* Action Selection */}
        <div>
          <label className="block text-2xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Action</label>
          <select
            value={selectedAction}
            onChange={(e) => { setSelectedAction(e.target.value); setResult(null); setSimulationResult(null); setHasSimulated(false); }}
            className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-white text-sm w-full focus:outline-none focus:ring-1 focus:ring-primary-light/50 focus:border-primary-light/50 transition-colors appearance-none cursor-pointer"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <p className="text-2xs text-zinc-600 mt-1.5 font-mono">
            Target: {actionConfig.target}
          </p>
        </div>

        {/* Amount Input */}
        {actionConfig.requiresAmount && (
          <div className="animate-fade-in">
            <label className="block text-2xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Amount</label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.05"
                step="any"
                min="0"
                className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-white placeholder-zinc-600 text-sm w-full focus:outline-none focus:ring-1 focus:ring-primary-light/50 focus:border-primary-light/50 transition-colors"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-2xs text-zinc-600 font-medium">WIRE</span>
            </div>
          </div>
        )}

        {/* PREDICT Parameters */}
        {selectedAction === 'PREDICT' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-400/5 border border-emerald-400/20 rounded-lg px-3 py-2">
              <span className="font-semibold">FREE</span>
              <span className="text-zinc-400">- Earn prediction points, no staking</span>
            </div>
            <div>
              <label className="form-label">Match</label>
              <select
                value={predMatchId}
                onChange={(e) => setPredMatchId(e.target.value)}
                className="input w-full"
              >
                {matches.length === 0 && <option value="">No matches available</option>}
                {matches.map((m) => (
                  <option key={m.matchId} value={m.matchId}>
                    #{m.matchId} - {m.team1} vs {m.team2}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Prediction Type</label>
              <select
                value={predType}
                onChange={(e) => { setPredType(e.target.value); setPredOutcome(''); }}
                className="input w-full"
              >
                <option value="MATCH_WINNER">Match Winner</option>
                <option value="TOP_SCORER">Top Scorer</option>
                <option value="TOTAL_RUNS">Total Runs</option>
              </select>
            </div>
            <div>
              <label className="form-label">Your Prediction</label>
              <select
                value={predOutcome}
                onChange={(e) => setPredOutcome(e.target.value)}
                className="input w-full"
              >
                <option value="">Select your prediction</option>
                {predType === 'MATCH_WINNER' && (() => {
                  const match = matches.find(m => String(m.matchId) === predMatchId);
                  const teamNames = match ? [match.team1, match.team2] : [...new Set(players.map(p => p.team))].slice(0, 2);
                  return (
                    <>
                      {teamNames.map(t => (
                        <option key={t} value={t.toUpperCase().replace(/\s+/g, '_')}>{t} Win</option>
                      ))}
                      <option value="TIE">Tie / Draw</option>
                    </>
                  );
                })()}
                {predType === 'TOP_SCORER' && (() => {
                  const match = matches.find(m => String(m.matchId) === predMatchId);
                  const teamNames = match ? [match.team1, match.team2] : [];
                  const batters = players.filter(p => p.role === 'BAT' || p.role === 'ALL' || p.role === 'WK');
                  if (teamNames.length > 0) {
                    return teamNames.map(team => {
                      const teamBatters = batters.filter(p => p.team === team);
                      if (teamBatters.length === 0) return null;
                      return (
                        <optgroup key={team} label={team}>
                          {teamBatters.map(p => (
                            <option key={p.id} value={p.name.toUpperCase().replace(/\s+/g, '_')}>{p.name} ({p.credits}cr)</option>
                          ))}
                        </optgroup>
                      );
                    });
                  }
                  return batters.slice(0, 20).map(p => (
                    <option key={p.id} value={p.name.toUpperCase().replace(/\s+/g, '_')}>{p.name} - {p.team} ({p.credits}cr)</option>
                  ));
                })()}
                {predType === 'TOTAL_RUNS' && (
                  <>
                    <option value="UNDER_120">Under 120 Runs</option>
                    <option value="UNDER_150">Under 150 Runs</option>
                    <option value="OVER_150">Over 150 Runs</option>
                    <option value="OVER_180">Over 180 Runs</option>
                    <option value="OVER_200">Over 200 Runs</option>
                  </>
                )}
              </select>
            </div>
          </div>
        )}

        {/* JOIN_CONTEST Parameters */}
        {selectedAction === 'JOIN_CONTEST' && (() => {
          const selectedIds = squadPlayerIds.filter(Boolean);
          const selectedPlayers = selectedIds.map(id => players.find(p => String(p.id) === id)).filter(Boolean);
          const totalCredits = selectedPlayers.reduce((sum, p) => sum + Number(p.credits || 0), 0);
          const remainingCredits = 100 - totalCredits;
          const ROLE_COLORS = { BAT: 'text-blue-400 bg-blue-400/10', BOWL: 'text-emerald-400 bg-emerald-400/10', ALL: 'text-amber-400 bg-amber-400/10', WK: 'text-purple-400 bg-purple-400/10' };

          function togglePlayer(pId) {
            const id = String(pId);
            const idx = squadPlayerIds.indexOf(id);
            if (idx >= 0) {
              const next = [...squadPlayerIds];
              next[idx] = '';
              // Compact: shift non-empty to front
              const compacted = next.filter(Boolean);
              while (compacted.length < 11) compacted.push('');
              setSquadPlayerIds(compacted);
              if (captainId === id) setCaptainId('');
              if (viceCaptainId === id) setViceCaptainId('');
            } else if (selectedIds.length < 11) {
              const next = [...squadPlayerIds];
              const emptyIdx = next.indexOf('');
              if (emptyIdx >= 0) next[emptyIdx] = id;
              setSquadPlayerIds(next);
            }
          }

          // Group players by team
          const teams = [...new Set(players.map(p => p.team))].sort();

          return (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-400/5 border border-emerald-400/20 rounded-lg px-3 py-2">
                <span className="font-semibold">FREE TO PLAY</span>
                <span className="text-zinc-400">- Sponsor-funded prizes</span>
              </div>
              <div>
                <label className="form-label">Match</label>
                <select value={predMatchId} onChange={(e) => setPredMatchId(e.target.value)} className="input w-full">
                  {matches.length === 0 && <option value="">No matches available</option>}
                  {matches.map((m) => (
                    <option key={m.matchId} value={m.matchId}>#{m.matchId} - {m.team1} vs {m.team2}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Contest</label>
                <select value={contestId} onChange={(e) => setContestId(e.target.value)} className="input w-full">
                  {contests.length === 0 && <option value="">No contests - enter ID manually</option>}
                  {contests.map((c) => (
                    <option key={c.contestId} value={c.contestId}>Contest #{c.contestId} - Pool: {c.sponsorPool || '0'} WIRE</option>
                  ))}
                </select>
                {contests.length === 0 && (
                  <input type="number" value={contestId} onChange={(e) => setContestId(e.target.value)} placeholder="Contest ID" className="input w-full mt-2" />
                )}
              </div>

              {/* Squad budget bar */}
              <div className="bg-zinc-800/40 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xs font-semibold text-zinc-400 uppercase tracking-wider">Squad Budget</span>
                  <span className={`text-sm font-bold tabular-nums ${remainingCredits < 0 ? 'text-red-400' : remainingCredits < 15 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {totalCredits}/100 credits
                  </span>
                </div>
                <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${remainingCredits < 0 ? 'bg-red-400' : 'bg-emerald-400'}`} style={{ width: `${Math.min(totalCredits, 100)}%` }} />
                </div>
                <div className="flex items-center justify-between mt-1.5 text-2xs text-zinc-500">
                  <span>{selectedIds.length}/11 players</span>
                  <span>{remainingCredits >= 0 ? `${remainingCredits} remaining` : `${Math.abs(remainingCredits)} over budget`}</span>
                </div>
              </div>

              {/* Player picker */}
              <div>
                <label className="form-label">Select Players</label>
                <div className="max-h-72 overflow-y-auto space-y-3 pr-1">
                  {teams.map(team => {
                    const teamPlayers = players.filter(p => p.team === team);
                    if (teamPlayers.length === 0) return null;
                    return (
                      <div key={team}>
                        <div className="text-2xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5 sticky top-0 bg-zinc-900/95 py-1">{team}</div>
                        <div className="space-y-0.5">
                          {teamPlayers.map(p => {
                            const isSelected = selectedIds.includes(String(p.id));
                            const isCaptain = captainId === String(p.id);
                            const isVC = viceCaptainId === String(p.id);
                            const disabled = !isSelected && selectedIds.length >= 11;
                            return (
                              <div
                                key={p.id}
                                onClick={() => !disabled && togglePlayer(p.id)}
                                className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-primary/10 border border-primary/30'
                                    : disabled
                                      ? 'bg-zinc-900/30 opacity-40 cursor-not-allowed'
                                      : 'bg-zinc-800/30 border border-transparent hover:bg-zinc-800/60 hover:border-zinc-700/50'
                                }`}
                              >
                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-primary border-primary-light' : 'border-zinc-700'}`}>
                                  {isSelected && <span className="text-white text-2xs font-bold">{selectedIds.indexOf(String(p.id)) + 1}</span>}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-white font-medium truncate">{p.name}</span>
                                    <span className={`text-2xs font-semibold px-1.5 py-0.5 rounded ${ROLE_COLORS[p.role] || 'text-zinc-400 bg-zinc-800'}`}>{p.role}</span>
                                  </div>
                                </div>
                                <span className="text-xs font-bold text-zinc-300 tabular-nums shrink-0">{Number(p.credits).toFixed(1)}</span>
                                {isSelected && (
                                  <div className="flex gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setCaptainId(isCaptain ? '' : String(p.id)); if (viceCaptainId === String(p.id)) setViceCaptainId(''); }}
                                      className={`text-2xs font-bold px-1.5 py-0.5 rounded transition-colors ${isCaptain ? 'bg-amber-400 text-black' : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'}`}
                                      title="Captain (2x points)"
                                    >C</button>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setViceCaptainId(isVC ? '' : String(p.id)); if (captainId === String(p.id)) setCaptainId(''); }}
                                      className={`text-2xs font-bold px-1.5 py-0.5 rounded transition-colors ${isVC ? 'bg-blue-400 text-black' : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'}`}
                                      title="Vice Captain (1.5x points)"
                                    >VC</button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {players.length > 0 && (
                  <div className="flex items-center gap-4 mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        // Greedy pick: sort by credits desc, pick players that fit in 100 budget
                        const sorted = [...players].sort((a, b) => (b.credits || 0) - (a.credits || 0));
                        const picked = [];
                        let budget = 100;
                        for (const p of sorted) {
                          if (picked.length >= 11) break;
                          if ((p.credits || 0) <= budget) {
                            picked.push(p);
                            budget -= (p.credits || 0);
                          }
                        }
                        const autoIds = picked.map(p => String(p.id));
                        // Pad to 11 if not enough
                        while (autoIds.length < 11) autoIds.push('');
                        setSquadPlayerIds(autoIds);
                        if (autoIds[0]) setCaptainId(autoIds[0]);
                        if (autoIds[1]) setViceCaptainId(autoIds[1]);
                      }}
                      className="text-xs text-primary-light hover:text-primary-light/80 transition-colors"
                    >
                      Auto-fill best 11 by credits
                    </button>
                    {selectedIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSquadPlayerIds(Array(11).fill(''));
                          setCaptainId('');
                          setViceCaptainId('');
                        }}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
                        Reset Selection
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Selected squad summary */}
              {selectedIds.length > 0 && (
                <div className="bg-zinc-800/30 rounded-xl p-3">
                  <div className="text-2xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Your Squad</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPlayers.map(p => (
                      <div key={p.id} className={`inline-flex items-center gap-1.5 text-2xs px-2 py-1 rounded-lg ${captainId === String(p.id) ? 'bg-amber-400/15 border border-amber-400/30 text-amber-300' : viceCaptainId === String(p.id) ? 'bg-blue-400/15 border border-blue-400/30 text-blue-300' : 'bg-zinc-800 text-zinc-300 border border-zinc-700/50'}`}>
                        {captainId === String(p.id) && <span className="font-bold text-amber-400">C</span>}
                        {viceCaptainId === String(p.id) && <span className="font-bold text-blue-400">VC</span>}
                        <span className="font-medium">{p.name}</span>
                        <span className="text-zinc-500">{Number(p.credits).toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        <div className="h-px bg-zinc-800/60" />

        {/* Advanced: Raw Calldata - hidden for clean demo UX */}

        {/* Nonce Display */}
        <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-3.5">
          <span className="text-2xs text-zinc-600 uppercase tracking-wider font-medium">Nonce</span>
          <p className="font-mono text-xs text-zinc-400 mt-1 break-all leading-relaxed">{nonce}</p>
        </div>

        <div className="h-px bg-zinc-800/60" />

        {/* Simulation Panel */}
        <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-zinc-200 tracking-tight">Simulation</h3>
            <button
              onClick={handleSimulate}
              disabled={simulating}
              className="btn-secondary text-xs py-1.5 px-3.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
            >
              {simulating ? (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 border-2 border-zinc-500 border-t-zinc-300 rounded-full animate-spin" />
                  Simulating
                </span>
              ) : 'Simulate'}
            </button>
          </div>
          {simulationResult && (
            <div className="space-y-2.5 animate-fade-in">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">Will Succeed</span>
                {simulationResult.willSucceed ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-400 text-2xs font-semibold uppercase tracking-wider bg-emerald-400/10 border border-emerald-400/20 rounded-lg px-2.5 py-1">
                    Yes
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-red-400 text-2xs font-semibold uppercase tracking-wider bg-red-400/10 border border-red-400/20 rounded-lg px-2.5 py-1">
                    No
                  </span>
                )}
              </div>
              {simulationResult.error && (
                <div className="text-sm text-red-400 mt-1">{simulationResult.error}</div>
              )}
              {simulationResult.willSucceed && !simulationResult.error && (
                <>
                  <div className="h-px bg-zinc-800/40" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Est. Gas</span>
                    <span className="text-zinc-300 font-mono text-xs">{simulationResult.estimatedGas}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Policy Check</span>
                    <span className="text-emerald-400 font-medium text-xs">{simulationResult.policyCheck}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Reputation Impact</span>
                    <span className="text-primary-light font-medium text-xs">{simulationResult.reputationImpact}</span>
                  </div>
                </>
              )}
            </div>
          )}
          {!simulationResult && !simulating && (
            <p className="text-2xs text-zinc-600 leading-relaxed">Run a simulation before executing to preview the outcome.</p>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-start gap-3 bg-red-400/5 border border-red-400/20 rounded-xl px-4 py-3 text-sm text-red-400 animate-fade-in">
            <Ban size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Gas Estimate */}
        <GasEstimate
          provider={signer?.provider}
          fallbackGas={350000n}
          label="Est. Gas Fee"
        />

        {/* Execute Button */}
        {!hasSimulated && (
          <div className="flex items-start gap-2.5 bg-amber-400/5 border border-amber-400/20 rounded-xl px-4 py-3 text-sm text-amber-400 animate-fade-in">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>Run a simulation before executing to preview the outcome and avoid wasting gas.</span>
          </div>
        )}
        <button
          onClick={handleExecute}
          disabled={txStatus !== null || !hasSimulated}
          className="btn-primary w-full py-3 rounded-xl font-medium text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
        >
          {txStatus === 'pending' && (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Sending Transaction...
            </span>
          )}
          {txStatus === 'confirming' && (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Confirming on WireFluid...
            </span>
          )}
          {txStatus === null && !hasSimulated && 'Simulate First'}
          {txStatus === null && hasSimulated && 'Execute Action'}
        </button>
      </div>

      {/* Success Result */}
      {result?.type === 'success' && (
        <div className="bg-emerald-400/[0.03] border border-emerald-400/20 rounded-2xl p-5 mt-6 animate-fade-in-up">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center shrink-0">
              <CheckCircle size={20} className="text-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-emerald-400">Action Executed Successfully</h3>
              <p className="text-sm text-zinc-500 mt-1">
                Gas Used: <span className="text-zinc-200 font-semibold">{result.gasUsed}</span>
              </p>
              <div className="mt-3">
                <a
                  href={`https://wirefluidscan.com/tx/${result.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary-light hover:text-primary-light/80 font-mono transition-colors duration-150"
                >
                  View on WireFluidScan
                  <ChevronRight size={14} />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Blocked Result */}
      {result?.type === 'blocked' && (
        <div className="bg-red-400/[0.03] border border-red-400/20 rounded-2xl p-5 mt-6 animate-fade-in-up">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-red-400/10 border border-red-400/20 flex items-center justify-center shrink-0">
              <Ban size={20} className="text-red-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-red-400">Action Blocked by Policy Engine</h3>
              <p className="text-sm text-zinc-500 mt-1">
                Reason: <span className="text-red-400/80">{result.reason}</span>
              </p>
              <div className="flex items-center gap-4 mt-3">
                <Link
                  to={`/policy/${agentId}`}
                  className="inline-flex items-center gap-1.5 text-sm text-primary-light hover:text-primary-light/80 font-medium transition-colors duration-150"
                >
                  Edit Policy
                  <ChevronRight size={14} />
                </Link>
                <a
                  href={`https://wirefluidscan.com/tx/${result.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-zinc-600 hover:text-zinc-400 font-mono transition-colors duration-150"
                >
                  View Transaction
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Failed Result (external call reverted) */}
      {result?.type === 'failed' && (
        <div className="bg-amber-400/[0.03] border border-amber-400/20 rounded-2xl p-5 mt-6 animate-fade-in-up">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} className="text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-amber-400">Execution Failed</h3>
              <p className="text-sm text-zinc-500 mt-1">
                Policy check passed, but the target contract call failed. Gas Used: <span className="text-zinc-200 font-semibold">{result.gasUsed}</span>
              </p>
              <p className="text-xs text-zinc-600 mt-1">
                This may happen if the target contract rejected the call (e.g. contest already joined, invalid parameters).
              </p>
              <div className="mt-3">
                <a
                  href={`https://wirefluidscan.com/tx/${result.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary-light hover:text-primary-light/80 font-mono transition-colors duration-150"
                >
                  View on WireFluidScan
                  <ChevronRight size={14} />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
