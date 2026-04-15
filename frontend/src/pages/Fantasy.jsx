import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useDispatch } from 'react-redux';
import { fetchContests as fetchReduxContests } from '../store/slices/fantasySlice';
import { Contract } from 'ethers';
import { Users, UserPlus, Trophy, Shield, Zap } from 'lucide-react';
import { API } from '../utils/addresses';
import { formatWIRE, shortenAddress } from '../utils/format';
import friendlyError from '../utils/friendlyError';
import Pagination from '../components/ui/Pagination';
import PageGuide from '../components/common/PageGuide';

const FANTASY_ABI = [
  {
    "inputs": [
      { "name": "contestId", "type": "uint256" },
      { "name": "playerIds", "type": "uint256[11]" },
      { "name": "captainId", "type": "uint256" },
      { "name": "viceCaptainId", "type": "uint256" },
      { "name": "totalCredits", "type": "uint256" }
    ],
    "name": "joinContest",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const TABS = ['Open Contests', 'My Squads', 'Leaderboard'];
const ROLE_COLORS = {
  BAT: 'bg-blue-500/20 text-blue-400',
  BOWL: 'bg-green-500/20 text-green-400',
  ALL: 'bg-purple-500/20 text-purple-400',
  WK: 'bg-yellow-500/20 text-yellow-400',
};

/* ─── Contest Card ──────────────────────────────────────────────── */

function ContestCard({ contest, connected, alreadyJoined, onJoin }) {
  const maxP = Number(contest.maxParticipants || 100);
  const joined = Number(contest.participantCount ?? 0);
  const fillPercent = maxP > 0 ? Math.min((joined / maxP) * 100, 100) : 0;
  const spotsLeft = maxP > 0 ? maxP - joined : '∞';
  const isFull = maxP > 0 && joined >= maxP;

  return (
    <div className={`card-hover flex flex-col overflow-hidden ${alreadyJoined ? 'opacity-60' : ''}`}>
      {/* Sponsor banner */}
      {contest.bannerUrl && (
        <div className="relative -mx-5 -mt-5 mb-0">
          <img src={contest.bannerUrl} alt={contest.sponsor || 'Sponsor'} className="w-full h-24 object-cover" onError={e => { e.target.style.display = 'none'; }} />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/40 to-transparent" />
        </div>
      )}
      <div className={`relative ${contest.bannerUrl ? '-mt-6 z-10' : '-mx-5 -mt-5 bg-gradient-to-r from-secondary/[0.08] to-transparent border-b border-zinc-800/40'} px-5 pt-4 pb-3 mb-4`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {contest.sponsorLogo && (
              <img src={contest.sponsorLogo} alt={contest.sponsor} className="w-8 h-8 rounded-lg object-cover border border-zinc-700/60 shrink-0 bg-zinc-800" onError={e => { e.target.style.display = 'none'; }} />
            )}
            <div className="min-w-0">
              <h3 className="font-semibold text-white text-sm truncate">
                {contest.name || `Contest #${contest.contestId || ''}`}
              </h3>
              <p className="text-2xs text-zinc-500 mt-0.5">{contest.matchName || 'PSL Match'}</p>
            </div>
          </div>
          {alreadyJoined
            ? <span className="badge bg-secondary/10 text-secondary shrink-0">JOINED</span>
            : <span className="badge-free shrink-0">FREE</span>}
        </div>
      </div>

      <div className="text-center mb-4 py-3 bg-zinc-800/30 rounded-xl border border-zinc-800/40">
        <p className="text-2xs text-zinc-500 uppercase tracking-wider font-medium mb-1">Prize Pool</p>
        <p className="text-xl font-bold text-accent tabular-nums">
          {contest.sponsorPool ? formatWIRE(BigInt(contest.sponsorPool)) : '0 WIRE'}
        </p>
      </div>

      <div className="space-y-3 mb-4 flex-1">
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-zinc-500">{joined} joined</span>
            <span className="text-zinc-400 font-medium">{spotsLeft} spots left</span>
          </div>
          <div className="progress-bar">
            <div
              className={`progress-fill ${isFull ? 'bg-red-500' : 'bg-gradient-to-r from-secondary to-secondary-light'}`}
              style={{ width: `${fillPercent}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 text-2xs text-zinc-500">
          <svg className="w-3 h-3 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            {contest.startTime
              ? `Starts ${new Date(contest.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
              : 'Starting soon'}
          </span>
        </div>
      </div>

      <div className="text-2xs text-zinc-600 mb-3 flex items-center gap-1.5">
        {contest.sponsorLogo ? (
          <img src={contest.sponsorLogo} alt="" className="w-4 h-4 rounded object-cover" onError={e => { e.target.style.display = 'none'; }} />
        ) : (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        )}
        <span>Sponsored by <span className="text-zinc-400 font-medium">{contest.sponsor || 'WireFluid'}</span></span>
      </div>

      <button
        onClick={() => onJoin(contest)}
        disabled={!connected || isFull || alreadyJoined}
        className={alreadyJoined ? 'btn-secondary w-full text-sm cursor-not-allowed' : 'btn-primary w-full text-sm'}
      >
        {alreadyJoined ? 'Already Joined' : isFull ? 'Contest Full' : connected ? 'Join Contest (FREE)' : 'Connect Wallet to Join'}
      </button>
    </div>
  );
}

/* ─── Player Card ───────────────────────────────────────────────── */

function PlayerCard({ player, isSelected, isCaptain, isVC, onToggle, onSetCaptain, onSetVC, disabled }) {
  return (
    <div
      onClick={() => !disabled && onToggle(player)}
      className={`card-surface cursor-pointer transition-all ${
        disabled && !isSelected ? 'opacity-40 cursor-not-allowed' : ''
      } ${
        isSelected
          ? 'border-primary-light/60 bg-primary-light/5 shadow-[0_0_12px_rgba(99,102,241,0.08)]'
          : 'hover:border-zinc-700/80 hover:-translate-y-px'
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-medium text-sm text-white truncate">{player.name}</span>
        <div className="flex items-center gap-1 shrink-0">
          {isCaptain && <span className="w-5 h-5 rounded-full bg-accent text-zinc-950 flex items-center justify-center text-2xs font-bold">C</span>}
          {isVC && <span className="w-5 h-5 rounded-full bg-secondary text-zinc-950 flex items-center justify-center text-2xs font-bold">VC</span>}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-2xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[player.role] || 'bg-zinc-500/20 text-zinc-400'}`}>{player.role}</span>
          <span className="text-2xs text-zinc-600">{player.team}</span>
        </div>
        <span className="text-2xs text-zinc-500 font-medium">{player.credits} cr</span>
      </div>
      {isSelected && (
        <div className="flex gap-1.5 mt-2 pt-2 border-t border-zinc-800/60">
          <button onClick={(e) => { e.stopPropagation(); onSetCaptain(player.id); }}
            className={`text-2xs px-2.5 py-1 rounded-md font-medium transition-colors ${isCaptain ? 'bg-accent text-zinc-950' : 'bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700/80'}`}>
            Captain
          </button>
          <button onClick={(e) => { e.stopPropagation(); onSetVC(player.id); }}
            className={`text-2xs px-2.5 py-1 rounded-md font-medium transition-colors ${isVC ? 'bg-secondary text-zinc-950' : 'bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700/80'}`}>
            Vice-Captain
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Squad Builder Modal ───────────────────────────────────────── */

function SquadBuilderModal({
  contest, players, selected, captain, viceCaptain,
  totalCredits, remainingCredits, submitting, submitSuccess, error,
  onTogglePlayer, onSetCaptain, onSetVC, onSubmit, onClose, onReset,
}) {
  const canSubmit = selected.length === 11 && captain && viceCaptain && totalCredits <= 100 && !submitting;
  const needMore = 11 - selected.length;

  const teams = {};
  players.forEach(p => { if (!teams[p.team]) teams[p.team] = []; teams[p.team].push(p); });

  const validationMessages = [];
  if (selected.length < 11) validationMessages.push(`Select ${needMore} more player${needMore > 1 ? 's' : ''}`);
  if (selected.length === 11 && !captain) validationMessages.push('Select a captain');
  if (selected.length === 11 && !viceCaptain) validationMessages.push('Select a vice-captain');
  if (totalCredits > 100) validationMessages.push(`Over budget by ${(totalCredits - 100).toFixed(1)} credits`);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Build Your Squad</h2>
            <p className="text-sm text-zinc-500 mt-0.5">{contest.name} · {contest.matchName || 'PSL Match'}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-zinc-800/80 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700/80 transition-colors text-lg">&times;</button>
        </div>

        {/* Status Bar */}
        <div className="sticky top-0 z-10 bg-zinc-900 -mx-6 px-6 py-3 mb-4 border-b border-zinc-800/60">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${selected.length === 11 ? 'bg-secondary/15 text-secondary' : 'bg-zinc-800 text-zinc-400'}`}>{selected.length}</div>
              <div><p className="text-xs font-medium text-white">/11 Players</p><p className="text-2xs text-zinc-600">{needMore > 0 ? `${needMore} more needed` : 'Squad complete'}</p></div>
            </div>
            <div className="w-px h-8 bg-zinc-800" />
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${totalCredits > 100 ? 'bg-red-500/15 text-red-400' : 'bg-primary/10 text-primary-light'}`}>{totalCredits % 1 === 0 ? totalCredits : totalCredits.toFixed(1)}</div>
              <div><p className="text-xs font-medium text-white">/100 Credits</p><p className={`text-2xs ${remainingCredits < 0 ? 'text-red-400' : 'text-zinc-600'}`}>{remainingCredits % 1 === 0 ? remainingCredits : remainingCredits.toFixed(1)} remaining</p></div>
            </div>
            <div className="w-px h-8 bg-zinc-800" />
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-2xs font-bold ${captain ? 'bg-accent text-zinc-950' : 'bg-zinc-800 text-zinc-600'}`}>C</span>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-2xs font-bold ${viceCaptain ? 'bg-secondary text-zinc-950' : 'bg-zinc-800 text-zinc-600'}`}>VC</span>
            </div>
            <div className="flex-1 min-w-[80px]">
              <div className="progress-bar h-2">
                <div className={`progress-fill ${totalCredits > 100 ? 'bg-red-500' : 'bg-gradient-to-r from-primary to-secondary'}`} style={{ width: `${Math.min(totalCredits, 100)}%` }} />
              </div>
            </div>
            {selected.length > 0 && (
              <button onClick={onReset} className="text-2xs text-red-400 hover:text-red-300 transition-colors font-medium whitespace-nowrap">Reset</button>
            )}
          </div>
        </div>

        {error && <div className="alert-error mb-4 text-sm">{error}</div>}
        {submitSuccess && (
          <div className="alert-success mb-4 text-sm flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            Squad submitted successfully! You're in the contest.
          </div>
        )}

        {Object.entries(teams).map(([teamName, teamPlayers]) => (
          <div key={teamName} className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{teamName}</h3>
              <span className="text-2xs text-zinc-600">({teamPlayers.length} players)</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {teamPlayers.map((player) => {
                const isSelected = selected.some((p) => p.id === player.id);
                return (
                  <PlayerCard key={player.id} player={player} isSelected={isSelected}
                    isCaptain={captain === player.id} isVC={viceCaptain === player.id}
                    disabled={(!isSelected && (totalCredits + player.credits) > 100) || (!isSelected && selected.length >= 11)}
                    onToggle={onTogglePlayer} onSetCaptain={onSetCaptain} onSetVC={onSetVC} />
                );
              })}
            </div>
          </div>
        ))}

        <div className="sticky bottom-0 bg-zinc-900 -mx-6 px-6 py-4 border-t border-zinc-800/60 mt-2">
          {validationMessages.length > 0 && !submitSuccess && (
            <div className="flex flex-wrap gap-2 mb-3">
              {validationMessages.map((msg, i) => (
                <span key={i} className="text-2xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">{msg}</span>
              ))}
            </div>
          )}
          <button onClick={onSubmit} disabled={!canSubmit || submitSuccess} className="btn-primary w-full py-3">
            {submitSuccess ? 'Squad Submitted!' : submitting ? 'Submitting to WireFluid...' : `Submit Squad (${selected.length}/11 players)`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── My Squad Card ─────────────────────────────────────────────── */

function MySquadCard({ entry }) {
  const { squad } = entry;
  return (
    <div className="card animate-fade-in-up">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-white">{entry.contestName}</h3>
          <p className="text-2xs text-zinc-500 mt-0.5">{entry.matchName}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-accent tabular-nums">{squad.totalPoints} pts</p>
          <p className="text-2xs text-zinc-600">{entry.finalized ? 'Finalized' : 'In Progress'}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <span className="text-2xs bg-zinc-800/60 text-zinc-400 px-2 py-0.5 rounded-md">
          Credits: {squad.totalCredits}/100
        </span>
        <span className="text-2xs bg-zinc-800/60 text-zinc-400 px-2 py-0.5 rounded-md">
          Prize Pool: {formatWIRE(BigInt(entry.sponsorPool))}
        </span>
        <span className="text-2xs bg-zinc-800/60 text-zinc-400 px-2 py-0.5 rounded-md">
          {entry.participantCount} participant{entry.participantCount !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="divider mb-3" />

      {/* Captain & VC */}
      <div className="flex gap-4 mb-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-accent text-zinc-950 flex items-center justify-center text-2xs font-bold">C</span>
          <span className="text-sm text-white font-medium">{squad.captainName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-secondary text-zinc-950 flex items-center justify-center text-2xs font-bold">VC</span>
          <span className="text-sm text-white font-medium">{squad.viceCaptainName}</span>
        </div>
      </div>

      {/* All players */}
      <div className="flex flex-wrap gap-1.5">
        {squad.playerNames.map((name, j) => {
          const pid = squad.playerIds[j];
          const isCaptain = pid === squad.captainId;
          const isVC = pid === squad.viceCaptainId;
          return (
            <span key={j} className={`text-2xs px-2.5 py-1 rounded-full border font-medium ${
              isCaptain ? 'bg-accent/15 text-accent border-accent/30'
              : isVC ? 'bg-secondary/15 text-secondary border-secondary/30'
              : 'bg-zinc-800/60 text-zinc-300 border-zinc-700/50'
            }`}>
              {name}{isCaptain ? ' (C)' : isVC ? ' (VC)' : ''}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────── */

export default function Fantasy() {
  const { address, signer, connected, connectMetaMask } = useWallet();
  const dispatch = useDispatch();
  const [tab, setTab] = useState('Open Contests');
  const [contests, setContests] = useState([]);
  const [matchId, setMatchId] = useState(4);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [buildingContest, setBuildingContest] = useState(null);
  const [players, setPlayers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [captain, setCaptain] = useState(null);
  const [viceCaptain, setViceCaptain] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [addresses, setAddresses] = useState(null);

  // My Squads
  const [mySquads, setMySquads] = useState([]);
  const [mySquadsLoading, setMySquadsLoading] = useState(false);

  // Pagination
  const [contestPage, setContestPage] = useState(1);
  const [squadPage, setSquadPage] = useState(1);
  const [lbPage, setLbPage] = useState(1);

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState(null);
  const [lbContestId, setLbContestId] = useState(2);
  const [lbLoading, setLbLoading] = useState(false);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(''), 8000);
    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    fetch(`${API}/health`).then(r => r.json()).then(d => setAddresses(d.contracts)).catch(() => {});
  }, []);

  /* ── Open Contests ── */
  const fetchContests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/fantasy/contests/${matchId}`);
      if (!res.ok) throw new Error('Failed to fetch contests');
      const data = await res.json();
      setContests(data.contests || data || []);
    } catch (err) {
      setError(friendlyError(err));
      setContests([]);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    if (tab === 'Open Contests') {
      fetchContests();
      dispatch(fetchReduxContests()); // sync to Redux store
    }
  }, [tab, fetchContests, dispatch]);

  /* ── My Squads ── */
  const fetchMySquads = useCallback(async () => {
    if (!address) return;
    setMySquadsLoading(true);
    try {
      const res = await fetch(`${API}/fantasy/my-squads/${address}`);
      if (!res.ok) throw new Error('Failed to fetch squads');
      const data = await res.json();
      setMySquads(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(friendlyError(err));
      setMySquads([]);
    } finally {
      setMySquadsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (tab === 'My Squads' && connected) fetchMySquads();
  }, [tab, connected, fetchMySquads]);

  /* ── Leaderboard ── */
  const fetchLeaderboard = useCallback(async () => {
    setLbLoading(true);
    try {
      const res = await fetch(`${API}/fantasy/leaderboard/${lbContestId}`);
      if (!res.ok) throw new Error('Failed to fetch leaderboard');
      const data = await res.json();
      setLeaderboard(data);
    } catch (err) {
      setError(friendlyError(err));
      setLeaderboard(null);
    } finally {
      setLbLoading(false);
    }
  }, [lbContestId]);

  useEffect(() => {
    if (tab === 'Leaderboard') fetchLeaderboard();
  }, [tab, fetchLeaderboard]);

  /* ── Squad Builder ── */
  const fetchPlayers = async (contestMatchId) => {
    try {
      const res = await fetch(`${API}/matches/players/${contestMatchId}`);
      if (!res.ok) {
        const allRes = await fetch(`${API}/matches/players`);
        if (!allRes.ok) throw new Error('Failed to fetch players');
        setPlayers(await allRes.json());
        return;
      }
      setPlayers(await res.json());
    } catch (err) {
      setModalError(friendlyError(err));
    }
  };

  const openSquadBuilder = async (contest) => {
    setBuildingContest(contest);
    setSelected([]);
    setCaptain(null);
    setViceCaptain(null);
    setModalError('');
    setSubmitSuccess(false);
    await fetchPlayers(contest.matchId || matchId);
  };

  const togglePlayer = (player) => {
    const isSelected = selected.some((p) => p.id === player.id);
    if (isSelected) {
      setSelected(selected.filter((p) => p.id !== player.id));
      if (captain === player.id) setCaptain(null);
      if (viceCaptain === player.id) setViceCaptain(null);
    } else if (selected.length < 11) {
      setSelected([...selected, player]);
    }
  };

  const totalCredits = selected.reduce((sum, p) => sum + (p.credits || 0), 0);
  const remainingCredits = 100 - totalCredits;

  const handleSetCaptain = (playerId) => { setCaptain(playerId); if (viceCaptain === playerId) setViceCaptain(null); };
  const handleSetVC = (playerId) => { setViceCaptain(playerId); if (captain === playerId) setCaptain(null); };

  const submitSquad = async () => {
    if (!buildingContest) return;
    if (!connected || !signer) { setModalError('Please connect your wallet before submitting a squad.'); return; }
    if (selected.length !== 11) { setModalError('Select exactly 11 players'); return; }
    if (!captain || !viceCaptain) { setModalError('Select a captain and vice-captain'); return; }
    if (totalCredits > 100) { setModalError(`Total credits (${totalCredits}) exceed budget of 100`); return; }

    setSubmitting(true);
    setModalError('');
    try {
      if (!addresses?.fantasyModule) throw new Error('Contract address not loaded. Please wait and retry.');
      const contestId = Number(buildingContest.contestId || buildingContest.id);
      const playerIds = selected.map((p) => p.id);
      const capId = captain;
      const vcId = viceCaptain;
      const credits = Math.round(totalCredits);

      console.log('Submitting:', { contestId, playerIds, capId, vcId, credits });

      // Use full compiled ABI from artifacts
      const artifact = await import('../abis/FantasyModule.json');
      const abi = artifact.default?.abi || artifact.abi;

      const contract = new Contract(addresses.fantasyModule, abi, signer);
      const tx = await contract.joinContest(
        contestId, playerIds, capId, vcId, credits,
        { gasLimit: 800000n }
      );
      await tx.wait();
      setSubmitSuccess(true);
      fetchContests();
    } catch (err) {
      console.error('Squad submission failed:', err);
      console.error('Contest ID:', buildingContest.contestId || buildingContest.id);
      console.error('Player IDs:', selected.map(p => p.id));
      console.error('Captain:', captain, 'VC:', viceCaptain, 'Credits:', Math.round(totalCredits));
      setModalError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setBuildingContest(null);
    setSelected([]);
    setCaptain(null);
    setViceCaptain(null);
    setModalError('');
    setSubmitSuccess(false);
  };

  // Check if user already joined a contest
  const userJoinedContest = (contest) => {
    if (!address) return false;
    return (contest.participants || []).includes(address.toLowerCase());
  };

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="page-title">Squad Challenge</h1>
          <span className="badge-free">FREE TO PLAY</span>
        </div>
        <p className="page-subtitle">Pick 11 cricket players, set your strategy and compete on the leaderboard. Prizes funded by sponsors.</p>
      </div>

      <PageGuide
        id="fantasy"
        title="How Squad Challenge Works"
        steps={[
          { icon: Users, title: 'Pick a Contest', desc: 'Each match has open contests with sponsor-funded prize pools. Browse by match and check the pool size.' },
          { icon: UserPlus, title: 'Build Your XI', desc: 'Select 11 players within a 100-credit budget. Assign a Captain (2x points) and Vice-Captain (1.5x points).' },
          { icon: Trophy, title: 'Win Sponsor Prizes', desc: 'Players score based on real match performance (runs, wickets, economy). Top squad on the leaderboard wins the prize pool.' },
        ]}
        tips={[
          'No entry fee. Sponsors and franchises fund the prize pools, not fans.',
          'Balance star players with budget picks to stay under 100 credits.',
          'Captain selection is everything. Pick your most reliable performer for 2x points.',
          'Join multiple contests with different strategies to maximize your chances.',
        ]}
      />

      {!connected && (
        <div className="bg-zinc-900/70 border border-amber-400/20 rounded-xl px-4 py-4 flex items-center justify-between gap-4 animate-fade-in">
          <span className="text-sm text-amber-300">Connect your wallet to build squads and join contests.</span>
          <button onClick={connectMetaMask} className="btn-primary text-sm px-4 py-2 shrink-0">Connect Wallet</button>
        </div>
      )}

      {error && (
        <div className="alert-error flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400/50 hover:text-red-400 transition-colors ml-3">&times;</button>
        </div>
      )}

      <div className="tab-group w-fit overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => { setTab(t); setContestPage(1); setSquadPage(1); setLbPage(1); }} className={`whitespace-nowrap ${tab === t ? 'tab-item-active' : 'tab-item'}`}>{t}</button>
        ))}
      </div>

      {/* ── Open Contests ── */}
      {tab === 'Open Contests' && (
        <div>
          <div className="flex items-center gap-3 mb-5">
            <label className="text-sm text-zinc-500">Match</label>
            <select value={matchId} onChange={(e) => { setMatchId(Number(e.target.value)); setContestPage(1); }} className="input-field w-auto">
              <option value={4}>Pindiz vs Karachi Kings</option>
              <option value={5}>Pindiz vs Lahore Qalandars</option>
              <option value={6}>Quetta Gladiators vs Pindiz</option>
            </select>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <div key={i} className="skeleton-card h-72 rounded-2xl" />)}
            </div>
          ) : contests.length === 0 ? (
            <div className="empty-state bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5">
              <p className="empty-state-title">No contests available</p>
              <p className="empty-state-desc">No contests found for this match yet.</p>
            </div>
          ) : (<>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {contests.slice((contestPage - 1) * 10, contestPage * 10).map((contest, i) => (
                <ContestCard
                  key={contest.contestId || i}
                  contest={contest}
                  connected={connected}
                  alreadyJoined={userJoinedContest(contest)}
                  onJoin={openSquadBuilder}
                />
              ))}
            </div>
            <Pagination
              page={contestPage}
              totalPages={Math.ceil(contests.length / 10)}
              onPageChange={setContestPage}
              className="mt-4"
            />
          </>)}
        </div>
      )}

      {/* ── Squad Builder Modal ── */}
      {buildingContest && (
        <SquadBuilderModal
          contest={buildingContest} players={players} selected={selected}
          captain={captain} viceCaptain={viceCaptain}
          totalCredits={totalCredits} remainingCredits={remainingCredits}
          submitting={submitting} submitSuccess={submitSuccess} error={modalError}
          onTogglePlayer={togglePlayer} onSetCaptain={handleSetCaptain} onSetVC={handleSetVC}
          onSubmit={submitSquad} onClose={closeModal}
          onReset={() => { setSelected([]); setCaptain(null); setViceCaptain(null); }}
        />
      )}

      {/* ── My Squads ── */}
      {tab === 'My Squads' && (
        <div>
          {!connected ? (
            <div className="empty-state bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5">
              <p className="empty-state-title">Wallet not connected</p>
              <p className="empty-state-desc">Connect your wallet to view your squads</p>
              <button onClick={connectMetaMask} className="btn-primary text-sm mt-4 px-6">Connect Wallet</button>
            </div>
          ) : mySquadsLoading ? (
            <div className="space-y-4">
              {[1, 2].map(i => <div key={i} className="skeleton-card h-48 rounded-2xl" />)}
            </div>
          ) : mySquads.length === 0 ? (
            <div className="empty-state bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5">
              <p className="empty-state-title">No squads submitted</p>
              <p className="empty-state-desc">Join an open contest, build your XI and submit your squad to start competing.</p>
              <button onClick={() => setTab('Open Contests')} className="btn-primary text-sm mt-4 px-6">Browse Contests</button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-zinc-500 mb-2">{mySquads.length} contest{mySquads.length !== 1 ? 's' : ''} joined</p>
              {mySquads.slice((squadPage - 1) * 10, squadPage * 10).map((entry) => (
                <MySquadCard key={entry.contestId} entry={entry} />
              ))}
              <Pagination
                page={squadPage}
                totalPages={Math.ceil(mySquads.length / 10)}
                onPageChange={setSquadPage}
                className="mt-4"
              />
            </div>
          )}
        </div>
      )}

      {/* ── Leaderboard ── */}
      {tab === 'Leaderboard' && (
        <div>
          <div className="flex items-center gap-3 mb-5">
            <label className="text-sm text-zinc-500">Contest</label>
            <select value={lbContestId} onChange={(e) => { setLbContestId(Number(e.target.value)); setLbPage(1); }} className="input-field w-auto">
              {[2, 3, 4, 5, 6, 7].map(id => <option key={id} value={id}>Contest #{id}</option>)}
            </select>
          </div>

          {lbLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="skeleton-card h-16 rounded-xl" />)}
            </div>
          ) : !leaderboard || (leaderboard.entries || []).length === 0 ? (
            <div className="empty-state bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5">
              <p className="empty-state-title">No participants yet</p>
              <p className="empty-state-desc">Be the first to join this contest!</p>
              <button onClick={() => setTab('Open Contests')} className="btn-primary text-sm mt-4 px-6">Browse Contests</button>
            </div>
          ) : (
            <div>
              {/* Contest info header */}
              <div className="card-surface mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">{leaderboard.contestName}</h3>
                  <p className="text-2xs text-zinc-500">{leaderboard.matchName}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-zinc-500">Prize Pool</p>
                    <p className="text-sm font-bold text-accent">{formatWIRE(BigInt(leaderboard.sponsorPool))}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500">Players</p>
                    <p className="text-sm font-bold text-white">{leaderboard.participantCount}</p>
                  </div>
                  <div>
                    <span className={`badge ${leaderboard.finalized ? 'bg-secondary/10 text-secondary' : 'bg-amber-500/10 text-amber-400'}`}>
                      {leaderboard.finalized ? 'FINALIZED' : 'LIVE'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Leaderboard table */}
              <div className="card overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="table-header border-b border-zinc-800/40">
                      <th className="table-cell text-left w-12">#</th>
                      <th className="table-cell text-left">Address</th>
                      <th className="table-cell text-left">Captain</th>
                      <th className="table-cell text-left">Vice-Captain</th>
                      <th className="table-cell text-right">Credits</th>
                      <th className="table-cell text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.entries.slice((lbPage - 1) * 10, lbPage * 10).map((entry, idx) => {
                      const i = (lbPage - 1) * 10 + idx;
                      const isMe = address && entry.address.toLowerCase() === address.toLowerCase();
                      return (
                        <tr key={i} className={`table-row ${isMe ? 'bg-primary/5' : ''}`}>
                          <td className="table-cell">
                            {i <= 2 ? (
                              <span className={`w-6 h-6 rounded-md inline-flex items-center justify-center text-2xs font-extrabold ${
                                i === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                                : i === 1 ? 'bg-gradient-to-br from-zinc-300 to-zinc-400 text-zinc-800'
                                : 'bg-gradient-to-br from-amber-700 to-amber-800 text-amber-200'
                              }`}>{i + 1}</span>
                            ) : (
                              <span className="text-zinc-600 font-medium">{i + 1}</span>
                            )}
                          </td>
                          <td className="table-cell">
                            <span className={`font-mono text-sm ${isMe ? 'text-primary-light font-semibold' : 'text-zinc-300'}`}>
                              {shortenAddress(entry.address)}
                              {isMe && <span className="text-2xs text-primary-light ml-1.5">(You)</span>}
                            </span>
                          </td>
                          <td className="table-cell text-zinc-400 text-xs">{entry.captainName}</td>
                          <td className="table-cell text-zinc-500 text-xs">{entry.viceCaptainName}</td>
                          <td className="table-cell text-right text-zinc-500 tabular-nums">{entry.totalCredits}</td>
                          <td className="table-cell text-right">
                            <span className="font-semibold text-white tabular-nums">{entry.totalPoints}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={lbPage}
                totalPages={Math.ceil(leaderboard.entries.length / 10)}
                onPageChange={setLbPage}
                className="mt-4"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
