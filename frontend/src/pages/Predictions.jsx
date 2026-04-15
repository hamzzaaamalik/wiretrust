import { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { useSelector, useDispatch } from 'react-redux';
import { fetchMatches } from '../store/slices/matchSlice';
import { fetchPredictions } from '../store/slices/fantasySlice';
import { ethers } from 'ethers';
import { Star, CheckCircle2, Crosshair, Flame, Target, Award, TrendingUp, Trophy, Crown } from 'lucide-react';
import { Link } from 'react-router-dom';
import PredictionCard from '../components/prediction/PredictionCard';
import CreatePrediction from '../components/prediction/CreatePrediction';
import Pagination from '../components/ui/Pagination';
import PageGuide from '../components/common/PageGuide';

const PREDICTION_ABI = [
  'function createPrediction(uint256 franchiseId, uint256 matchId, bytes32 predictionType, bytes32 predictedOutcome) external returns (uint256)',
  'function getUserStats(address user) view returns (tuple(uint256 totalPoints, uint256 totalCorrect, uint256 totalPredictions, uint256 currentStreak))',
];

import friendlyError from '../utils/friendlyError';

const TABS = ['Make Prediction', 'My Predictions', 'Leaderboard'];

const STAT_CONFIGS = [
  { key: 'totalPoints',      label: 'Total Points',   color: 'text-accent',      Icon: Star },
  { key: 'totalCorrect',     label: 'Correct',        color: 'text-emerald-400', Icon: CheckCircle2 },
  { key: 'accuracy',         label: 'Accuracy',       color: 'text-primary-light', Icon: Crosshair },
  { key: 'currentStreak',    label: 'Current Streak', color: 'text-amber-400',   Icon: Flame },
];

function shortenAddr(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function PredictionLeaderboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/predictions/leaderboard?limit=20');
        if (res.ok) setData(await res.json());
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center justify-between py-3 px-4 bg-zinc-900/70 rounded-xl">
            <div className="h-4 w-40 bg-zinc-800 rounded animate-pulse" />
            <div className="h-4 w-20 bg-zinc-800 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  const entries = data?.entries || [];

  if (entries.length === 0) {
    return (
      <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5 text-center py-16">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent/15 to-accent/5 flex items-center justify-center mx-auto mb-4">
          <Trophy size={24} className="text-accent/60" />
        </div>
        <p className="text-zinc-400 text-sm font-semibold mb-1">No predictions yet</p>
        <p className="text-zinc-600 text-xs">Make predictions on PSL matches to appear on the leaderboard.</p>
      </div>
    );
  }

  const rankColors = {
    1: 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-[0_0_8px_rgba(245,158,11,0.3)]',
    2: 'bg-gradient-to-br from-zinc-300 to-zinc-400 text-zinc-800',
    3: 'bg-gradient-to-br from-amber-700 to-amber-800 text-amber-200',
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-3">
        <Trophy size={14} className="text-accent" />
        <span className="text-sm font-semibold text-white">Top Predictors</span>
        <span className="text-2xs text-zinc-600 bg-zinc-800/60 rounded-md px-2 py-0.5 font-medium ml-auto">
          {data?.totalPredictors || 0} predictors
        </span>
      </div>
      {entries.map((entry, i) => {
        const rank = i + 1;
        return (
          <Link
            key={entry.address}
            to={`/fan/${entry.address}`}
            className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-zinc-800/50 transition-all group bg-zinc-900/50"
          >
            <div className="flex items-center gap-3">
              {rankColors[rank] ? (
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-2xs font-extrabold ${rankColors[rank]}`}>{rank}</span>
              ) : (
                <span className="w-7 h-7 rounded-lg flex items-center justify-center text-2xs font-bold bg-zinc-800 text-zinc-600">{rank}</span>
              )}
              <div>
                <span className="text-sm text-zinc-300 font-mono group-hover:text-white transition-colors block leading-tight">
                  {shortenAddr(entry.address)}
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-2xs text-zinc-500">
                    {entry.totalCorrect}/{entry.totalPredictions} correct
                  </span>
                  <span className="text-2xs text-zinc-600">|</span>
                  <span className="text-2xs text-zinc-500">{entry.accuracy}% accuracy</span>
                  {entry.currentStreak >= 3 && (
                    <>
                      <span className="text-2xs text-zinc-600">|</span>
                      <span className="text-2xs text-amber-400 flex items-center gap-0.5">
                        <Flame size={10} /> {entry.currentStreak}x
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-accent tabular-nums">{entry.totalPoints.toLocaleString()}</span>
              <span className="text-2xs text-zinc-500 block">points</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export default function Predictions() {
  const { signer, address, connected, connectMetaMask } = useWallet();
  const dispatch = useDispatch();

  // Redux state
  const reduxMatches = useSelector((s) => s.matches.all);
  const reduxPredictions = useSelector((s) => s.fantasy.predictions);

  const [tab, setTab] = useState(0);
  const [matches, setMatches] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [stats, setStats] = useState(null);
  const [addresses, setAddresses] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [matchPlayers, setMatchPlayers] = useState({});
  const [predPage, setPredPage] = useState(1);

  // Also dispatch to Redux store for cross-page access
  useEffect(() => {
    dispatch(fetchMatches());
  }, [dispatch]);

  useEffect(() => {
    fetch('/api/matches/schedule')
      .then(r => r.json())
      .then(data => {
        const now = new Date();
        const enriched = (data || []).map(m => ({
          ...m,
          id: m.id ?? m.matchId,
          started: m.startTime ? new Date(m.startTime) <= now : false,
        }));
        enriched.sort((a, b) => (a.started === b.started ? 0 : a.started ? 1 : -1));
        setMatches(enriched);
      })
      .catch(() => setError('Failed to load matches. Please refresh.'));
    fetch('/api/health').then(r => r.json()).then(d => setAddresses(d.contracts)).catch(() => {});
  }, []);

  // Fetch players when a match is selected
  useEffect(() => {
    if (!selectedMatchId) return;
    if (matchPlayers[selectedMatchId]) return;
    fetch(`/api/matches/players/${selectedMatchId}`)
      .then(r => r.json())
      .then(data => {
        setMatchPlayers(prev => ({ ...prev, [selectedMatchId]: data.players || data || [] }));
      })
      .catch(() => {});
  }, [selectedMatchId]);

  // Build enriched matches with players injected
  const enrichedMatches = matches.map(m => ({
    ...m,
    players: matchPlayers[m.id] || [],
  }));

  useEffect(() => {
    if (!address) return;
    // Fetch predictions — also dispatch to Redux
    dispatch(fetchPredictions(address));
    fetch(`/api/predictions/user/${address}`)
      .then(r => r.json())
      .then(data => {
        if (!data || typeof data !== 'object') return;
        setPredictions(data.predictions || []);
        setStats(data.stats || null);
      })
      .catch(() => {});
  }, [address, success, dispatch]);

  async function handleSubmit({ matchId, predictionType, predictedOutcome }) {
    if (!connected || !signer) {
      setError('Please connect your wallet first.');
      return;
    }
    if (!addresses) {
      setError('Loading contract addresses. Please try again in a moment.');
      return;
    }
    setSubmitting(true);
    setSuccess(null);
    setError(null);

    try {
      const contract = new ethers.Contract(addresses.predictionModule, PREDICTION_ABI, signer);
      const typeBytes = ethers.encodeBytes32String(predictionType);
      const outcomeBytes = ethers.encodeBytes32String(predictedOutcome);
      const tx = await contract.createPrediction(1, matchId, typeBytes, outcomeBytes, {
        gasLimit: 400000n, gasPrice: 10000000000n,
      });
      await tx.wait();
      setSuccess('Prediction submitted! Earn points when the match is resolved.');
      setTab(1);
    } catch (err) {
      console.error('Prediction failed:', err);
      console.error('Match:', matchId, 'Type:', predictionType, 'Outcome:', predictedOutcome);
      setSuccess(null);
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  function getStatValue(key) {
    if (!stats) return '-';
    if (key === 'accuracy') {
      return stats.totalPredictions > 0
        ? `${Math.round((Number(stats.totalCorrect) / Number(stats.totalPredictions)) * 100)}%`
        : '-';
    }
    return stats[key]?.toString() || '0';
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Predictions</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Call the winner, top scorer or total runs. Earn points and build streaks.
          </p>
        </div>
        <span className="badge-free text-sm shrink-0">FREE</span>
      </div>

      <PageGuide
        id="predictions"
        title="How Predictions Work"
        steps={[
          { icon: Target, title: 'Pick a Match', desc: 'Choose an upcoming PSL match. Select your prediction type: Match Winner, Top Scorer or Total Runs (Over/Under).' },
          { icon: Crosshair, title: 'Make Your Call', desc: 'Submit your prediction on-chain. Completely free. No staking, no entry fee, no money at risk.' },
          { icon: Award, title: 'Earn Points & Badges', desc: 'Correct predictions earn base points plus streak bonuses. Hit 3x, 5x or 10x streaks to unlock soulbound badges.' },
        ]}
        tips={[
          'Points only. No staking, no wagering. This is skill-based fan engagement.',
          'Predict early for the early bird bonus (50 extra points if submitted 1+ hour before match start).',
          'Streak multiplier: each consecutive correct prediction adds 25 bonus points (capped at 200).',
          'Your prediction accuracy and streak history are recorded on-chain permanently.',
        ]}
      />

      {/* ── Stats Bar ──────────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STAT_CONFIGS.map(({ key, label, color, Icon }) => (
            <div
              key={key}
              className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5
                         hover:border-zinc-700/80 hover:bg-zinc-900/90
                         transition-all duration-200 text-center"
            >
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Icon size={14} className={`${color} opacity-60`} />
                <span className={`text-2xl font-bold tabular-nums tracking-tight ${color}`}>
                  {getStatValue(key)}
                </span>
              </div>
              <div className="text-2xs font-medium text-zinc-500 uppercase tracking-wider mt-0.5">
                {label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs ───────────────────────────────────────────────────── */}
      <div className="tab-group">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`flex-1 ${tab === i ? 'tab-item-active' : 'tab-item'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Wallet prompt ───────────────────────────────────────────── */}
      {!connected && (
        <div className="bg-zinc-900/70 border border-amber-400/20 rounded-xl px-4 py-4 flex items-center justify-between gap-4 animate-fade-in">
          <span className="text-sm text-amber-300">Connect your wallet to make predictions and earn points.</span>
          <button onClick={connectMetaMask} className="btn-primary text-sm px-4 py-2 shrink-0">Connect Wallet</button>
        </div>
      )}

      {/* ── Alerts ─────────────────────────────────────────────────── */}
      {success && (
        <div className="alert-success">{success}</div>
      )}
      {error && (
        <div className="flex items-start gap-3 bg-red-400/5 border border-red-400/20 rounded-xl px-4 py-3 text-sm text-red-400 animate-fade-in">
          <span className="shrink-0 mt-0.5">!</span>
          <span>{error}</span>
        </div>
      )}

      {/* ── Tab: Make Prediction ───────────────────────────────────── */}
      {tab === 0 && (
        <CreatePrediction
          matches={enrichedMatches}
          onSubmit={handleSubmit}
          userStats={stats}
          onMatchSelect={setSelectedMatchId}
          submitting={submitting}
        />
      )}

      {/* ── Tab: My Predictions ────────────────────────────────────── */}
      {tab === 1 && (
        <div className="space-y-3">
          {predictions.length === 0 ? (
            <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5 text-center py-16">
              <div className="empty-state">
                <p className="empty-state-title">No predictions yet</p>
                <p className="empty-state-desc">
                  Pick an upcoming PSL match, make your call and start earning points.
                </p>
                <button
                  onClick={() => setTab(0)}
                  className="btn-primary text-sm mt-4 px-6"
                >
                  Make a Prediction
                </button>
              </div>
            </div>
          ) : (
            <>
              {predictions.slice((predPage - 1) * 10, predPage * 10).map(p => (
                <PredictionCard key={p.predictionId?.toString()} prediction={p} />
              ))}
              <Pagination
                page={predPage}
                totalPages={Math.ceil(predictions.length / 10)}
                onPageChange={setPredPage}
                className="mt-4"
              />
            </>
          )}
        </div>
      )}

      {/* ── Tab: Leaderboard ───────────────────────────────────────── */}
      {tab === 2 && (
        <PredictionLeaderboard />
      )}
    </div>
  );
}
