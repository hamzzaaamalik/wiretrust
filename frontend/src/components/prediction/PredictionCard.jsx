import React from 'react';

const STATUS_CONFIG = {
  OPEN: {
    label: 'Open',
    classes: 'badge-primary',
  },
  RESOLVED_CORRECT: {
    label: 'Correct',
    classes: 'badge-safe',
  },
  RESOLVED_WRONG: {
    label: 'Wrong',
    classes: 'badge-risky',
  },
  CANCELLED: {
    label: 'Cancelled',
    classes: 'badge bg-zinc-500/10 text-zinc-400 border border-zinc-500/20',
  },
};

const PREDICTION_TYPE_LABELS = {
  MATCH_WINNER: 'Match Winner',
  TOP_SCORER: 'Top Scorer',
  TOTAL_RUNS: 'Total Runs',
};

function formatDate(val) {
  if (!val) return '';
  try {
    const ts = typeof val === 'string' ? Number(val) : val;
    const d = new Date(ts);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function PredictionCard({ prediction, matchData }) {
  const {
    matchName,
    predictionType,
    predictedOutcome,
    status = 'OPEN',
    pointsEarned,
    createdAt,
  } = prediction || {};

  const statusKey =
    status === 'RESOLVED' && prediction?.correct
      ? 'RESOLVED_CORRECT'
      : status === 'RESOLVED' && !prediction?.correct
        ? 'RESOLVED_WRONG'
        : status;

  const config = STATUS_CONFIG[statusKey] || STATUS_CONFIG.OPEN;
  const isCorrect = statusKey === 'RESOLVED_CORRECT';

  const displayMatch = matchName || matchData?.matchName || 'Unknown Match';

  return (
    <div
      className={`bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5 transition-all animate-fade-in-up ${
        isCorrect
          ? 'border-accent/30 shadow-glow-accent hover:border-accent/40'
          : 'hover:border-zinc-700/80 hover:shadow-card-hover hover:-translate-y-px'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-base font-bold text-white leading-snug pr-3">{displayMatch}</h3>
        <span className={`${config.classes} shrink-0`}>{config.label}</span>
      </div>

      {/* Type badge */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="badge bg-zinc-800/60 text-zinc-400 border border-zinc-700/50">
          {PREDICTION_TYPE_LABELS[predictionType] || predictionType}
        </span>
      </div>

      {/* Prediction details surface */}
      <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-4 mb-4 space-y-3">
        <div>
          <p className="text-2xs text-zinc-500 uppercase tracking-wider font-medium mb-0.5">Your Prediction</p>
          <p className="text-base font-semibold text-zinc-200">{predictedOutcome || '--'}</p>
        </div>

        {pointsEarned != null && statusKey !== 'OPEN' && Number(pointsEarned) > 0 && (
          <>
            <div className="divider" />
            <div>
              <p className="text-2xs text-zinc-500 uppercase tracking-wider font-medium mb-0.5">Points Earned</p>
              <p className={`text-lg font-bold ${isCorrect ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {isCorrect ? '+' : ''}{pointsEarned}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        {createdAt && (
          <p className="text-2xs text-zinc-600">Predicted on {formatDate(createdAt)}</p>
        )}
        {isCorrect && (
          <span className="text-2xs font-semibold text-accent tracking-wide">Correct!</span>
        )}
      </div>
    </div>
  );
}
