import { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import {
  Ticket, Star, Gem, Shield, ShoppingBag, Trophy, Lock, CheckCircle2,
  Target, Flame, Users, Monitor, ChevronRight, Award, Loader2, Gift
} from 'lucide-react';
import QRTicket from '../components/nft/QRTicket';
import Pagination from '../components/ui/Pagination';
import PageGuide from '../components/common/PageGuide';

const CATEGORIES = ['All', 'Tickets', 'Experiences', 'Collectibles', 'Badges', 'Merch', 'My Rewards'];

const CATEGORY_ICONS = {
  TICKET: Ticket,
  EXPERIENCE: Star,
  COLLECTIBLE: Gem,
  BADGE: Shield,
  MERCHANDISE: ShoppingBag,
};

const CATEGORY_COLORS = {
  TICKET: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', gradient: 'from-blue-600 to-blue-800', ring: 'ring-blue-500/30' },
  EXPERIENCE: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20', gradient: 'from-purple-600 to-pink-600', ring: 'ring-purple-500/30' },
  COLLECTIBLE: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', gradient: 'from-amber-500 to-orange-600', ring: 'ring-amber-500/30' },
  BADGE: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', gradient: 'from-emerald-500 to-teal-600', ring: 'ring-emerald-500/30' },
  MERCHANDISE: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20', gradient: 'from-red-500 to-rose-600', ring: 'ring-red-500/30' },
};

const CONDITION_LABELS = {
  PREDICTIONS_MADE: { label: 'Predictions Made', icon: Target },
  PREDICTION_STREAK: { label: 'Prediction Streak', icon: Flame },
  PREDICTION_POINTS: { label: 'Prediction Points', icon: Trophy },
  CORRECT_PREDICTIONS: { label: 'Correct Predictions', icon: CheckCircle2 },
  FANTASY_JOINS: { label: 'Squad Challenges Joined', icon: Users },
  AGENT_CREATED: { label: 'Agents Deployed', icon: Monitor },
  REPUTATION_SCORE: { label: 'Best Agent Score', icon: Award },
  NFTS_EARNED: { label: 'NFTs Earned', icon: Gem },
};

/* ═══════════════════════════════════════════
   PROGRESS RING SVG
   ═══════════════════════════════════════════ */
function ProgressRing({ percentage, size = 48 }) {
  const radius = (size - 5) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (percentage / 100) * circumference;
  const color = percentage >= 100 ? '#10B981' : percentage >= 50 ? '#FBBF24' : '#7C3AED';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(63,63,70,0.3)" strokeWidth="3" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={circumference - progress}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {percentage >= 100 ? (
          <CheckCircle2 size={size * 0.38} className="text-emerald-400" />
        ) : (
          <span className="text-2xs font-bold text-zinc-400 tabular-nums">{percentage}%</span>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   CHALLENGE CARD
   ═══════════════════════════════════════════ */
function ChallengeCard({ challenge, onClaim, claiming, connected }) {
  const cat = CATEGORY_COLORS[challenge.category] || CATEGORY_COLORS.BADGE;
  const CatIcon = CATEGORY_ICONS[challenge.category] || Shield;
  const condInfo = CONDITION_LABELS[challenge.condition?.type] || { label: challenge.condition?.type, icon: Target };
  const CondIcon = condInfo.icon;
  const { progress, claimable, alreadyClaimed, soldOut } = challenge;

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 animate-fade-in-up ${
        alreadyClaimed
          ? 'border-emerald-500/20 bg-emerald-500/[0.03]'
          : claimable
            ? `border-accent/30 bg-accent/[0.03] hover:border-accent/50 hover:shadow-glow-accent`
            : 'border-zinc-800/60 bg-zinc-900/70 hover:border-zinc-700/60'
      }`}
    >
      {/* Top gradient bar */}
      <div className={`h-1 bg-gradient-to-r ${cat.gradient}`} />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start gap-4 mb-4">
          {/* Progress ring */}
          <ProgressRing percentage={progress?.percentage ?? 0} size={52} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-bold text-white truncate">{challenge.name}</h3>
              {alreadyClaimed && (
                <span className="badge-safe shrink-0">Claimed</span>
              )}
              {soldOut && !alreadyClaimed && (
                <span className="badge bg-zinc-500/10 text-zinc-500 border border-zinc-500/20 shrink-0">Sold Out</span>
              )}
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">{challenge.description}</p>
          </div>
        </div>

        {/* Condition info */}
        <div className="flex items-center gap-2 mb-3">
          <div className={`flex items-center gap-1.5 ${cat.bg} rounded-lg px-2.5 py-1`}>
            <CatIcon size={12} className={cat.text} />
            <span className={`text-2xs font-medium ${cat.text}`}>{challenge.category}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-zinc-800/50 rounded-lg px-2.5 py-1">
            <CondIcon size={11} className="text-zinc-500" />
            <span className="text-2xs text-zinc-500 font-medium">{condInfo.label}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-2xs text-zinc-600 font-medium">Progress</span>
            <span className="text-2xs font-semibold tabular-nums text-zinc-400">
              {progress?.current ?? 0} / {progress?.target ?? challenge.condition?.target}
            </span>
          </div>
          <div className="h-2 bg-zinc-800/80 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                progress?.percentage >= 100
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                  : 'bg-gradient-to-r from-primary to-primary-light'
              }`}
              style={{ width: `${Math.min(progress?.percentage ?? 0, 100)}%` }}
            />
          </div>
        </div>

        {/* Reward preview */}
        <div className="bg-zinc-900/60 border border-zinc-800/40 rounded-xl p-3 mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cat.gradient} flex items-center justify-center shrink-0`}>
              <CatIcon size={18} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-zinc-300 truncate">{challenge.reward?.name}</p>
              <p className="text-2xs text-zinc-600">{challenge.reward?.description?.slice(0, 60)}</p>
            </div>
          </div>
        </div>

        {/* Supply info + action */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {challenge.maxClaims > 0 && (
              <span className="text-2xs text-zinc-600 font-medium">
                {challenge.totalClaimed}/{challenge.maxClaims} claimed
              </span>
            )}
            {challenge.maxClaims === 0 && (
              <span className="text-2xs text-zinc-600 font-medium">Unlimited</span>
            )}
          </div>

          {alreadyClaimed ? (
            <div className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 size={14} />
              <span className="text-xs font-semibold">Earned</span>
            </div>
          ) : claimable ? (
            <button
              onClick={() => onClaim(challenge.id)}
              disabled={claiming}
              className="btn-primary text-xs py-2 px-5 flex items-center gap-2 shadow-glow-sm"
            >
              {claiming ? (
                <><Loader2 size={12} className="animate-spin" /> Claiming...</>
              ) : (
                <><Award size={12} /> Claim Reward</>
              )}
            </button>
          ) : soldOut ? (
            <span className="text-xs text-zinc-600 font-medium">No supply left</span>
          ) : !connected ? (
            <div className="flex items-center gap-1.5 text-zinc-600">
              <Lock size={12} />
              <span className="text-2xs font-medium">Connect wallet</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-zinc-600">
              <Lock size={12} />
              <span className="text-2xs font-medium">Target not met</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════ */
export default function Marketplace() {
  const { address, connected, connectMetaMask } = useWallet();
  const [tab, setTab] = useState(0);
  const [page, setPage] = useState(1);
  const [challenges, setChallenges] = useState([]);
  const [ownedNfts, setOwnedNfts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [qrToken, setQrToken] = useState(null);

  // Auto-clear alerts
  useEffect(() => {
    if (!success && !error) return;
    const timer = setTimeout(() => { setSuccess(null); setError(null); }, 6000);
    return () => clearTimeout(timer);
  }, [success, error]);

  // Fetch challenges
  useEffect(() => {
    loadChallenges();
  }, [address]);

  // Fetch owned NFTs when on "My Rewards" tab
  useEffect(() => {
    if (tab === 6 && address) loadOwnedNfts();
  }, [tab, address]);

  async function loadChallenges() {
    setLoading(true);
    try {
      const url = address
        ? `/api/challenges/1?address=${address}`
        : `/api/challenges/1`;
      const res = await fetch(url);
      const data = await res.json();
      setChallenges(Array.isArray(data) ? data : []);
    } catch {
      setChallenges([]);
    }
    setLoading(false);
  }

  async function loadOwnedNfts() {
    if (!address) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/nfts/owned/${address}`);
      const data = await res.json();
      const tokenIds = data.tokenIds || [];
      if (tokenIds.length > 0) {
        const metaResults = await Promise.allSettled(
          tokenIds.map(id => fetch(`/api/nfts/${id}`).then(r => r.json()))
        );
        setOwnedNfts(metaResults.filter(r => r.status === 'fulfilled').map(r => r.value));
      } else {
        setOwnedNfts([]);
      }
    } catch {
      setOwnedNfts([]);
    }
    setLoading(false);
  }

  async function handleClaim(challengeId) {
    if (!connected || !address) {
      setError('Connect your wallet first.');
      return;
    }
    setClaiming(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch('/api/challenges/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId, address }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Claim failed');
      } else {
        setSuccess(`Reward claimed: ${data.rewardName}`);
        loadChallenges(); // Refresh progress
      }
    } catch (err) {
      setError('Failed to claim reward. Please try again.');
    }
    setClaiming(false);
  }

  // Filter challenges by category
  const categoryFilter = ['All', 'TICKET', 'EXPERIENCE', 'COLLECTIBLE', 'BADGE', 'MERCHANDISE'];
  const filtered = tab === 0 || tab === 6
    ? challenges
    : challenges.filter(c => c.category === categoryFilter[tab]);

  const ITEMS_PER_PAGE = 12;
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedFiltered = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  // Stats
  const totalChallenges = challenges.length;
  const completed = challenges.filter(c => c.alreadyClaimed).length;
  const claimable = challenges.filter(c => c.claimable).length;

  const CATEGORY_NAMES_MAP = { 0: 'TICKET', 1: 'EXPERIENCE', 2: 'COLLECTIBLE', 3: 'BADGE', 4: 'MERCHANDISE' };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Challenges & Rewards</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Hit on-chain targets set by The Pindiz to earn NFT rewards across five categories
        </p>
      </div>

      <PageGuide
        title="How Challenges Work"
        steps={[
          { icon: Target, title: 'Browse Challenges', desc: 'The Pindiz franchise sets on-chain targets: predict matches, join squad contests, deploy agents or build streaks.' },
          { icon: Trophy, title: 'Track Progress', desc: 'Your blockchain activity is tracked automatically. Progress rings show exactly how close you are to each reward.' },
          { icon: Gift, title: 'Claim NFT Rewards', desc: 'Hit the target and claim your reward. Match tickets, player cards, VIP experiences, achievement badges or authenticated merch.' },
        ]}
        tips={[
          'Every NFT is earned through on-chain activity. Nothing is purchased with credits in this section.',
          'Badge NFTs are soulbound (non-transferable). They serve as permanent proof of your achievement.',
          'Some rewards have limited supply. Complete the challenge and claim before they run out.',
          'Ticket and experience NFTs include QR codes for venue entry and verification.',
        ]}
      />

      {/* Stats bar */}
      {connected && challenges.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card-surface text-center py-4">
            <p className="text-xl font-bold text-white tabular-nums">{totalChallenges}</p>
            <p className="text-2xs text-zinc-500 font-medium mt-0.5">Total Challenges</p>
          </div>
          <div className="card-surface text-center py-4">
            <p className="text-xl font-bold text-emerald-400 tabular-nums">{completed}</p>
            <p className="text-2xs text-zinc-500 font-medium mt-0.5">Completed</p>
          </div>
          <div className="card-surface text-center py-4">
            <p className="text-xl font-bold text-accent tabular-nums">{claimable}</p>
            <p className="text-2xs text-zinc-500 font-medium mt-0.5">Ready to Claim</p>
          </div>
        </div>
      )}

      {/* Alerts */}
      {success && <div className="alert-success animate-fade-in">{success}</div>}
      {error && (
        <div className="flex items-start gap-3 bg-red-400/5 border border-red-400/20 rounded-xl px-4 py-3 text-sm text-red-400 animate-fade-in">
          <span className="shrink-0 mt-0.5">!</span>
          <span>{error}</span>
        </div>
      )}

      {/* Wallet prompt */}
      {!connected && (
        <div className="bg-zinc-900/70 border border-amber-400/20 rounded-xl px-4 py-4 flex items-center justify-between gap-4 animate-fade-in">
          <span className="text-sm text-amber-300">Connect your wallet to track progress and claim rewards.</span>
          <button onClick={connectMetaMask} className="btn-primary text-sm px-4 py-2 shrink-0">Connect Wallet</button>
        </div>
      )}

      {/* Category Tabs */}
      <div className="tab-group overflow-x-auto">
        {CATEGORIES.map((cat, i) => (
          <button
            key={cat}
            onClick={() => { setTab(i); setPage(1); }}
            className={`whitespace-nowrap ${tab === i ? 'tab-item-active' : 'tab-item'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 6 ? (
        /* ── My Rewards tab ─────────────────────────────── */
        !connected ? (
          <div className="empty-state bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5">
            <p className="empty-state-title">Wallet not connected</p>
            <p className="empty-state-desc mt-1">Connect your wallet to view your earned rewards.</p>
            <button onClick={connectMetaMask} className="btn-primary text-sm mt-4 px-6">Connect Wallet</button>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-40 rounded-2xl bg-zinc-900/70 border border-zinc-800/60 animate-pulse" />)}
          </div>
        ) : ownedNfts.length === 0 ? (
          <div className="empty-state bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-accent/15 to-accent/5 flex items-center justify-center mb-4">
              <Trophy size={28} className="text-accent/60" />
            </div>
            <p className="empty-state-title">No rewards earned yet</p>
            <p className="empty-state-desc mt-1">Complete challenges to earn your first NFT reward.</p>
            <button onClick={() => setTab(0)} className="btn-primary text-sm mt-4 px-6">Browse Challenges</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in-up">
            {ownedNfts.map((nft, i) => {
              const catName = CATEGORY_NAMES_MAP[nft.category] || 'BADGE';
              const cat = CATEGORY_COLORS[catName] || CATEGORY_COLORS.BADGE;
              const CatIcon = CATEGORY_ICONS[catName] || Shield;
              return (
                <div key={nft.tokenId || i} className={`rounded-2xl border ${cat.border} bg-zinc-900/70 overflow-hidden`}>
                  <div className={`h-1.5 bg-gradient-to-r ${cat.gradient}`} />
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cat.gradient} flex items-center justify-center`}>
                        <CatIcon size={18} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{nft.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-2xs font-medium ${cat.text}`}>{catName}</span>
                          {nft.soulbound && <span className="text-2xs text-zinc-600">Soulbound</span>}
                        </div>
                      </div>
                    </div>
                    {nft.description && (
                      <p className="text-xs text-zinc-500 mb-3 line-clamp-2">{nft.description}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-2xs text-zinc-700 font-mono">Token #{nft.tokenId}</span>
                      {(catName === 'TICKET' || catName === 'EXPERIENCE') && nft.eventTimestamp > 0 && (
                        <button
                          onClick={() => setQrToken(nft)}
                          className="text-2xs text-primary-light font-medium hover:underline flex items-center gap-1"
                        >
                          <Ticket size={10} /> Show QR
                        </button>
                      )}
                      <div className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 size={12} />
                        <span className="text-2xs font-semibold">Earned</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* ── Challenges tabs ────────────────────────────── */
        loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-64 rounded-2xl bg-zinc-900/70 border border-zinc-800/60 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-zinc-800/60 flex items-center justify-center mb-4">
              <Target size={28} className="text-zinc-600" />
            </div>
            <p className="empty-state-title">No challenges in this category</p>
            <p className="empty-state-desc mt-1">Check other categories or come back later for new challenges.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {paginatedFiltered.map((ch, i) => (
                <ChallengeCard
                  key={ch.id}
                  challenge={ch}
                  onClaim={handleClaim}
                  claiming={claiming}
                  connected={connected}
                />
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-4" />
          </>
        )
      )}

      {/* QR Ticket Modal */}
      {qrToken && (
        <QRTicket
          tokenId={qrToken.tokenId}
          name={qrToken.name}
          eventDate={qrToken.eventTimestamp}
          onClose={() => setQrToken(null)}
        />
      )}
    </div>
  );
}
