import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { shortenAddress } from '../utils/format';

const TABS = ['Agents', 'Predictions', 'NFTs', 'Activity'];

export default function FanProfile() {
  const { address } = useParams();
  const [tab, setTab] = useState(0);
  const [balance, setBalance] = useState(null);
  const [agents, setAgents] = useState([]);
  const [predictions, setPredictions] = useState(null);
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [balRes, agentRes, predRes, nftRes] = await Promise.allSettled([
          fetch(`/api/auth/balance/${address}`).then(r => r.json()),
          fetch(`/api/agents/owner/${address}`).then(r => r.json()),
          fetch(`/api/predictions/user/${address}`).then(r => r.json()),
          fetch(`/api/nfts/owned/${address}`).then(r => r.json()),
        ]);
        if (balRes.status === 'fulfilled') setBalance(balRes.value.balance);
        if (agentRes.status === 'fulfilled') setAgents(agentRes.value || []);
        if (predRes.status === 'fulfilled') {
          setPredictions(predRes.value);
        }

        // Fetch metadata for each owned NFT
        if (nftRes.status === 'fulfilled') {
          const tokenIds = nftRes.value?.tokenIds || [];
          if (tokenIds.length > 0) {
            const metadataResults = await Promise.allSettled(
              tokenIds.map(id => fetch(`/api/nfts/${id}`).then(r => r.json())),
            );
            setNfts(metadataResults.filter(r => r.status === 'fulfilled').map(r => r.value));
          }
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [address]);

  const stats = predictions?.stats;
  const totalPredictions = Number(stats?.totalPredictions || 0);
  const totalCorrect = Number(stats?.totalCorrect || 0);
  const accuracy = totalPredictions > 0 ? Math.round((totalCorrect / totalPredictions) * 100) : 0;

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton-card h-24 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Hero Card ── */}
      <div className="card-gradient text-center sm:text-left sm:flex sm:items-center sm:gap-6">
        <div className="w-16 h-16 shrink-0 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-2xl font-bold text-white mx-auto sm:mx-0 shadow-lg shadow-indigo-500/20">
          {address?.slice(2, 4).toUpperCase()}
        </div>

        <div className="mt-3 sm:mt-0 min-w-0">
          <h1 className="text-2xl font-bold text-white tracking-tight font-mono truncate">
            {shortenAddress(address)}
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Balance:{' '}
            <span className="text-white font-medium">{balance || '-'} WIRE</span>
          </p>
          <a
            href={`https://wirefluidscan.com/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-1 text-indigo-400 text-2xs font-medium hover:text-indigo-300 hover:underline transition-colors"
          >
            View on WireFluidScan &rarr;
          </a>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { value: agents.length, label: 'Agents', color: 'text-indigo-400' },
          { value: `${accuracy}%`, label: 'Prediction Accuracy', color: 'text-emerald-400' },
          { value: stats?.currentStreak?.toString() || '0', label: 'Current Streak', color: 'text-amber-400' },
          { value: stats?.totalPoints?.toString() || '0', label: 'Prediction Points', color: 'text-violet-400' },
        ].map(({ value, label, color }) => (
          <div key={label} className="card-hover text-center py-4">
            <div className={`metric-value text-2xl font-bold ${color}`}>{value}</div>
            <div className="metric-label text-2xs text-zinc-500 mt-1 uppercase tracking-wider">{label}</div>
          </div>
        ))}
      </div>

      {/* ── How You Earn ── */}
      <div className="card-surface">
        <h3 className="text-sm font-semibold text-white mb-3">How You Earn</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/10 p-3">
            <div className="text-2xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">Predictions</div>
            <p className="text-2xs text-zinc-400 leading-relaxed">Make FREE predictions. Earn points for correct picks. Build streaks for bonus points and badges.</p>
          </div>
          <div className="rounded-xl bg-violet-500/5 border border-violet-500/10 p-3">
            <div className="text-2xs font-semibold text-violet-400 uppercase tracking-wider mb-1">Squad Challenge</div>
            <p className="text-2xs text-zinc-400 leading-relaxed">Join FREE contests. Build your best XI. Win sponsor-funded WIRE prizes. Top squads earn rewards.</p>
          </div>
          <div className="rounded-xl bg-amber-500/5 border border-amber-500/10 p-3">
            <div className="text-2xs font-semibold text-amber-400 uppercase tracking-wider mb-1">Challenges & NFTs</div>
            <p className="text-2xs text-zinc-400 leading-relaxed">Complete challenges to earn soulbound badges. Buy tickets, collectibles and merch in the marketplace.</p>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
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

      {/* ── Tab: Agents ── */}
      {tab === 0 && (
        <div className="space-y-3 animate-fade-in-up">
          {agents.length === 0 ? (
            <div className="empty-state bg-zinc-900/70 border border-zinc-800/80 rounded-2xl py-14 text-center">
              <div className="empty-state-title text-zinc-400 font-medium mb-1">No agents created yet</div>
              <p className="empty-state-desc text-zinc-500 text-sm mb-5">
                Deploy your first AI agent to start building on-chain reputation.
              </p>
              <Link to="/create-agent" className="btn-primary inline-block">
                Create Agent
              </Link>
            </div>
          ) : (
            agents.map((id, i) => (
              <Link key={i} to={`/agent/${id}`} className="card-interactive block">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">Agent #{id.toString()}</span>
                  <span className="text-indigo-400 text-sm font-medium">View &rarr;</span>
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {/* ── Tab: Predictions ── */}
      {tab === 1 && (
        <div className="space-y-3 animate-fade-in-up">
          {!predictions?.predictions?.length ? (
            <div className="empty-state bg-zinc-900/70 border border-zinc-800/80 rounded-2xl py-14 text-center">
              <div className="empty-state-title text-zinc-400 font-medium mb-1">No predictions yet</div>
              <p className="empty-state-desc text-zinc-500 text-sm mb-5">
                Predict PSL match outcomes to earn points and build streaks.
              </p>
              <Link to="/predict" className="btn-primary inline-block">
                Make a Prediction
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-zinc-400 mb-3">
                <span className="font-medium text-white">{totalCorrect}/{totalPredictions}</span>
                correct
                <span className="divider mx-1 h-3.5 w-px bg-zinc-700" />
                <span className="font-medium text-emerald-400">{accuracy}%</span>
                accuracy
              </div>

              {predictions.predictions.slice(0, 20).map((p, i) => (
                <div
                  key={i}
                  className={`card-surface py-3 border-l-4 ${
                    p.correct
                      ? 'border-l-emerald-500'
                      : p.status === 0
                        ? 'border-l-zinc-600'
                        : 'border-l-red-500'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-zinc-300">Match #{p.matchId?.toString()}</span>
                    <span
                      className={
                        p.correct
                          ? 'badge-safe'
                          : p.status === 0
                            ? 'inline-flex items-center rounded-full px-2.5 py-0.5 text-2xs font-medium bg-zinc-700/50 text-zinc-400'
                            : 'badge-risky'
                      }
                    >
                      {p.status === 0 ? 'OPEN' : p.correct ? 'CORRECT' : 'WRONG'}
                    </span>
                  </div>
                  {p.pointsEarned > 0 && (
                    <div className="text-violet-400 text-sm font-medium mt-1">
                      +{p.pointsEarned.toString()} points
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: NFTs ── */}
      {tab === 2 && (
        <div className="animate-fade-in-up">
          {nfts.length === 0 ? (
            <div className="empty-state bg-zinc-900/70 border border-zinc-800/80 rounded-2xl py-14 text-center">
              <div className="empty-state-title text-zinc-400 font-medium mb-1">NFT Rewards</div>
              <p className="empty-state-desc text-zinc-500 text-sm mb-5">
                Complete challenges to earn tickets, collectibles, badges and more.
              </p>
              <Link to="/marketplace" className="btn-primary inline-block">
                Browse Challenges
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {nfts.map(nft => (
                <div
                  key={nft.tokenId}
                  className="card-surface flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-white truncate">{nft.name}</span>
                      {nft.categoryName && (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-2xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          {nft.categoryName}
                        </span>
                      )}
                    </div>
                    {nft.description && (
                      <p className="text-sm text-zinc-500 truncate">{nft.description}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-accent">{nft.facePrice} WIRE</div>
                    <div className="text-2xs text-zinc-500">#{nft.tokenId}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Activity ── */}
      {tab === 3 && (
        <div className="empty-state bg-zinc-900/70 border border-zinc-800/80 rounded-2xl py-14 text-center animate-fade-in-up">
          <div className="empty-state-title text-zinc-400 font-medium mb-1">Activity Feed</div>
          <p className="empty-state-desc text-zinc-500 text-sm">
            On-chain activity (squad entries, predictions, NFT claims) will appear here as you engage.
          </p>
        </div>
      )}
    </div>
  );
}
