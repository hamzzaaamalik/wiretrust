import React, { useState } from 'react';
import { Trophy, User, BarChart3 } from 'lucide-react';

const PREDICTION_TYPES = [
  { value: 'MATCH_WINNER', label: 'Match Winner', icon: <Trophy size={24} strokeWidth={1.5} /> },
  { value: 'TOP_SCORER', label: 'Top Scorer', icon: <User size={24} strokeWidth={1.5} /> },
  { value: 'TOTAL_RUNS', label: 'Total Runs', icon: <BarChart3 size={24} strokeWidth={1.5} /> },
];

function MatchSelector({ matches, value, onChange }) {
  const upcoming = (matches || []).filter(m => !m.started);
  const started = (matches || []).filter(m => m.started);

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-zinc-300">Select Match</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="input-field">
        <option value="">-- Choose a match --</option>
        {upcoming.length > 0 && (
          <optgroup label="Upcoming (Open for predictions)">
            {upcoming.map((m) => (
              <option key={m.id} value={m.id}>
                {m.team1} vs {m.team2} · {m.date || ''}
              </option>
            ))}
          </optgroup>
        )}
        {started.length > 0 && (
          <optgroup label="Started (Predictions closed)">
            {started.map((m) => (
              <option key={m.id} value={m.id} disabled>
                {m.team1} vs {m.team2} · {m.date || ''} (started)
              </option>
            ))}
          </optgroup>
        )}
      </select>
      {upcoming.length === 0 && (
        <p className="text-2xs text-amber-400 mt-1.5">No upcoming matches available for predictions right now.</p>
      )}
    </div>
  );
}

function TypeSelector({ value, onChange }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-zinc-300">Prediction Type</label>
      <div className="grid grid-cols-3 gap-3">
        {PREDICTION_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={`rounded-xl border p-4 text-center transition-all duration-200 ${
              value === t.value
                ? 'border-primary bg-primary/10 shadow-[0_0_12px_rgba(99,102,241,0.1)]'
                : 'border-zinc-800/60 bg-zinc-900/50 hover:border-zinc-700/80 hover:bg-zinc-800/40'
            }`}
          >
            <div className={`mx-auto mb-1.5 ${value === t.value ? 'text-primary' : 'text-zinc-500'}`}>{t.icon}</div>
            <span className={`block text-2xs font-medium ${value === t.value ? 'text-zinc-200' : 'text-zinc-400'}`}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MatchWinnerInput({ match, value, onChange }) {
  if (!match) return null;
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-zinc-300">Pick the Winner</label>
      <div className="grid grid-cols-2 gap-4">
        {[match.team1, match.team2].map((team) => (
          <button
            key={team}
            type="button"
            onClick={() => onChange(team)}
            className={`rounded-xl border-2 px-4 py-6 text-center text-lg font-bold transition-all duration-200 ${
              value === team
                ? 'border-primary bg-primary/10 text-primary-light shadow-[0_0_16px_rgba(99,102,241,0.1)]'
                : 'border-zinc-800/60 bg-zinc-900/50 text-zinc-300 hover:border-zinc-700/80 hover:bg-zinc-800/40'
            }`}
          >
            {team}
          </button>
        ))}
      </div>
    </div>
  );
}

function TopScorerInput({ match, value, onChange }) {
  const players = match?.players || [];
  const [search, setSearch] = useState('');

  const filtered = players.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-zinc-300">Select Top Scorer</label>
      <input
        type="text"
        placeholder="Search players..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="input-field mb-2 text-sm"
      />
      <div className="max-h-48 overflow-y-auto rounded-xl border border-zinc-800/60 bg-zinc-900/70">
        {filtered.length === 0 && (
          <p className="p-3 text-sm text-zinc-500">No players found</p>
        )}
        {filtered.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.name)}
            className={`block w-full px-3 py-2.5 text-left text-sm transition-colors border-b border-zinc-800/40 last:border-b-0 ${
              value === p.name
                ? 'bg-primary/10 text-primary-light'
                : 'text-zinc-300 hover:bg-zinc-800/50'
            }`}
          >
            {p.name}
            {p.team && <span className="ml-2 text-2xs text-zinc-500">({p.team})</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function TotalRunsInput({ value, onChange }) {
  const direction = value?.direction || 'OVER';
  const threshold = value?.threshold || '';

  function update(patch) {
    onChange({ direction, threshold, ...value, ...patch });
  }

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-zinc-300">Over / Under</label>
      <div className="flex gap-3">
        <div className="flex overflow-hidden rounded-xl border border-zinc-800/60">
          {['OVER', 'UNDER'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => update({ direction: d })}
              className={`px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
                direction === d
                  ? 'bg-primary text-white'
                  : 'bg-zinc-900/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        <input
          type="number"
          placeholder="Threshold (e.g. 320)"
          value={threshold}
          onChange={(e) => update({ threshold: e.target.value })}
          className="input-field flex-1 text-sm"
        />
      </div>
    </div>
  );
}

export default function CreatePrediction({ matches = [], onSubmit, userStats, onMatchSelect, submitting = false }) {
  const [matchId, setMatchId] = useState('');
  const [predictionType, setPredictionType] = useState('');
  const [outcome, setOutcome] = useState(null);

  const selectedMatch = matches.find((m) => String(m.id) === String(matchId));

  const streak = userStats?.currentStreak ?? 0;
  const totalPoints = userStats?.totalPoints ?? 0;

  const isValid = matchId && predictionType && outcome &&
    (predictionType !== 'TOTAL_RUNS' || (outcome?.threshold && Number(outcome.threshold) > 0 && outcome?.direction));

  function handleSubmit(e) {
    e.preventDefault();
    if (!isValid) return;
    onSubmit?.({
      matchId,
      predictionType,
      predictedOutcome: predictionType === 'TOTAL_RUNS'
        ? `${outcome.direction} ${outcome.threshold}`
        : outcome,
    });
  }

  function handleTypeChange(type) {
    setPredictionType(type);
    setOutcome(type === 'TOTAL_RUNS' ? { direction: 'OVER', threshold: '' } : null);
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-xl space-y-6 animate-fade-in-up">
      {/* Free Badge */}
      <div className="alert-success text-center">
        <span className="text-base font-bold">FREE -- Earn Points!</span>
      </div>

      {/* User Stats */}
      <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-4 flex items-center justify-center gap-6 text-sm">
        <span className="text-zinc-400">
          Streak: <span className="font-bold text-accent">{streak}</span>
        </span>
        <div className="h-4 w-px bg-zinc-800" />
        <span className="text-zinc-400">
          Points: <span className="font-bold text-primary-light">{totalPoints.toLocaleString()}</span>
        </span>
      </div>

      {/* Form fields */}
      <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5 space-y-5">
        <MatchSelector matches={matches} value={matchId} onChange={(id) => { setMatchId(id); onMatchSelect?.(id); }} />

        {matchId && (
          <>
            <div className="divider" />
            <TypeSelector value={predictionType} onChange={handleTypeChange} />
          </>
        )}

        {predictionType === 'MATCH_WINNER' && (
          <>
            <div className="divider" />
            <MatchWinnerInput match={selectedMatch} value={outcome} onChange={setOutcome} />
          </>
        )}

        {predictionType === 'TOP_SCORER' && (
          <>
            <div className="divider" />
            <TopScorerInput match={selectedMatch} value={outcome} onChange={setOutcome} />
          </>
        )}

        {predictionType === 'TOTAL_RUNS' && (
          <>
            <div className="divider" />
            <TotalRunsInput value={outcome} onChange={setOutcome} />
          </>
        )}
      </div>

      <button
        type="submit"
        disabled={!isValid || submitting}
        className="btn-success w-full py-3 text-base font-bold"
      >
        {submitting ? 'Submitting...' : 'Submit Prediction'}
      </button>
    </form>
  );
}
