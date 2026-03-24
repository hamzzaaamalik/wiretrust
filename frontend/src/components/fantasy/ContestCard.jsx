import React from 'react';

const STATUS_STYLES = {
  ACTIVE: 'bg-green-900/50 text-green-400 border-green-700',
  LOCKED: 'bg-yellow-900/50 text-yellow-400 border-yellow-700',
  FINALIZED: 'bg-gray-800 text-gray-400 border-gray-600',
};

const STATUS_LABELS = {
  ACTIVE: 'Active',
  LOCKED: 'Locked',
  FINALIZED: 'Finalized',
};

function formatWire(amount) {
  if (amount == null) return '0 WIRE';
  const num = Number(amount);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M WIRE`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K WIRE`;
  return `${num.toLocaleString()} WIRE`;
}

export default function ContestCard({ contest, onJoin }) {
  const {
    id,
    matchName,
    team1,
    team2,
    sponsorPool,
    participants,
    maxParticipants,
    status = 'ACTIVE',
    freeToPlay = true,
  } = contest || {};

  const displayMatch = matchName || `${team1 || '???'} vs ${team2 || '???'}`;
  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.ACTIVE;
  const statusLabel = STATUS_LABELS[status] || status;

  const participantText = maxParticipants
    ? `${participants || 0}/${maxParticipants}`
    : `${participants || 0} joined`;

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-5 transition-shadow hover:shadow-lg hover:shadow-indigo-900/10">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="text-lg font-bold text-gray-100">{displayMatch}</h3>
        <span className={`shrink-0 rounded border px-2 py-0.5 text-xs font-semibold ${statusStyle}`}>
          {statusLabel}
        </span>
      </div>

      {/* Free to Play Badge */}
      {freeToPlay && (
        <span className="badge-free mb-3 inline-block rounded-full bg-emerald-900/40 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-400">
          Free to Play
        </span>
      )}

      {/* Sponsor Pool */}
      <div className="mb-3">
        <p className="text-xs uppercase tracking-wide text-gray-500">Sponsor Pool</p>
        <p className="text-xl font-bold text-yellow-400">{formatWire(sponsorPool)}</p>
      </div>

      {/* Participants */}
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-400">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>{participantText}</span>
      </div>

      {/* Actions */}
      {status === 'ACTIVE' && (
        <button
          type="button"
          onClick={() => onJoin?.(id)}
          className="btn-success w-full rounded-lg bg-green-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-green-500"
        >
          Join Contest
        </button>
      )}

      {status === 'FINALIZED' && (
        <a
          href={`/contests/${id}/leaderboard`}
          className="block w-full rounded-lg border border-gray-600 px-4 py-2.5 text-center text-sm font-medium text-gray-300 transition-colors hover:border-gray-400 hover:text-gray-100"
        >
          View Leaderboard
        </a>
      )}
    </div>
  );
}
