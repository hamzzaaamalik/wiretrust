import React, { useState, useMemo } from 'react';

const ROLE_COLORS = {
  BAT: 'bg-blue-600 text-blue-100',
  BOWL: 'bg-red-600 text-red-100',
  ALL: 'bg-purple-600 text-purple-100',
  WK: 'bg-green-600 text-green-100',
};

const ROLE_LABELS = {
  BAT: 'BAT',
  BOWL: 'BOWL',
  ALL: 'ALL',
  WK: 'WK',
};

function PlayerCard({ player, selected, onToggle, disabled }) {
  return (
    <button
      type="button"
      onClick={() => onToggle(player.id)}
      disabled={disabled && !selected}
      className={`
        w-full rounded-lg border p-3 text-left transition-all
        ${selected
          ? 'border-indigo-500 bg-gray-700 ring-1 ring-indigo-500'
          : 'border-gray-700 bg-gray-800 hover:border-gray-500'}
        ${disabled && !selected ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}
      `}
    >
      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-100">{player.name}</span>
        <span className={`rounded px-2 py-0.5 text-xs font-bold ${ROLE_COLORS[player.role] || 'bg-gray-600 text-gray-200'}`}>
          {ROLE_LABELS[player.role] || player.role}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between text-sm">
        <span className="text-gray-400">{player.team}</span>
        <span className="font-medium text-yellow-400">{player.credits} cr</span>
      </div>
    </button>
  );
}

function SelectedPlayerRow({ player, designation, onDesignationChange, onRemove }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2">
      <span className="flex-1 text-sm font-medium text-gray-100">{player.name}</span>
      <select
        value={designation}
        onChange={(e) => onDesignationChange(player.id, e.target.value)}
        className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        <option value="PLAYER">Player</option>
        <option value="CAPTAIN">Captain</option>
        <option value="VICE_CAPTAIN">Vice Captain</option>
      </select>
      <button
        type="button"
        onClick={() => onRemove(player.id)}
        className="text-gray-500 hover:text-red-400"
        aria-label={`Remove ${player.name}`}
      >
        &times;
      </button>
    </div>
  );
}

export default function SquadBuilder({ players = [], onSubmit, maxCredits = 100 }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [designations, setDesignations] = useState({});

  const selectedPlayers = useMemo(
    () => players.filter((p) => selectedIds.has(p.id)),
    [players, selectedIds],
  );

  const creditsUsed = useMemo(
    () => selectedPlayers.reduce((sum, p) => sum + (p.credits || 0), 0),
    [selectedPlayers],
  );

  const creditsRemaining = maxCredits - creditsUsed;

  const creditPercent = Math.min((creditsUsed / maxCredits) * 100, 100);
  const creditBarColor =
    creditPercent > 90 ? 'bg-red-500' : creditPercent > 70 ? 'bg-yellow-500' : 'bg-green-500';

  const captainCount = Object.values(designations).filter((d) => d === 'CAPTAIN').length;
  const viceCaptainCount = Object.values(designations).filter((d) => d === 'VICE_CAPTAIN').length;

  const isValid =
    selectedIds.size === 11 &&
    captainCount === 1 &&
    viceCaptainCount === 1 &&
    creditsUsed <= maxCredits;

  function togglePlayer(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setDesignations((d) => {
          const copy = { ...d };
          delete copy[id];
          return copy;
        });
      } else if (next.size < 11) {
        const player = players.find((p) => p.id === id);
        if (player && creditsUsed + player.credits <= maxCredits) {
          next.add(id);
          setDesignations((d) => ({ ...d, [id]: 'PLAYER' }));
        }
      }
      return next;
    });
  }

  function handleDesignationChange(playerId, value) {
    setDesignations((prev) => {
      const next = { ...prev };

      if (value === 'CAPTAIN') {
        Object.keys(next).forEach((k) => {
          if (next[k] === 'CAPTAIN') next[k] = 'PLAYER';
        });
      }
      if (value === 'VICE_CAPTAIN') {
        Object.keys(next).forEach((k) => {
          if (next[k] === 'VICE_CAPTAIN') next[k] = 'PLAYER';
        });
      }

      next[playerId] = value;
      return next;
    });
  }

  function removePlayer(id) {
    togglePlayer(id);
  }

  function handleSubmit() {
    if (!isValid) return;
    const squad = selectedPlayers.map((p) => ({
      playerId: p.id,
      designation: designations[p.id] || 'PLAYER',
    }));
    onSubmit?.(squad);
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Player Grid */}
      <div className="flex-1">
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm text-gray-300">
            <span>Credits: {creditsRemaining}/{maxCredits}</span>
            <span>{selectedIds.size}/11 players</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-700">
            <div
              className={`h-full transition-all ${creditBarColor}`}
              style={{ width: `${creditPercent}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {players.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              selected={selectedIds.has(player.id)}
              onToggle={togglePlayer}
              disabled={selectedIds.size >= 11 || creditsUsed + (player.credits || 0) > maxCredits}
            />
          ))}
        </div>
      </div>

      {/* Your Squad Sidebar */}
      <div className="w-full shrink-0 lg:w-80">
        <div className="rounded-xl border border-gray-700 bg-gray-900 p-4">
          <h3 className="mb-3 text-lg font-bold text-gray-100">Your Squad</h3>

          {selectedPlayers.length === 0 && (
            <p className="text-sm text-gray-500">Select players from the grid to build your squad.</p>
          )}

          <div className="flex flex-col gap-2">
            {selectedPlayers.map((player) => (
              <SelectedPlayerRow
                key={player.id}
                player={player}
                designation={designations[player.id] || 'PLAYER'}
                onDesignationChange={handleDesignationChange}
                onRemove={removePlayer}
              />
            ))}
          </div>

          {selectedIds.size > 0 && (
            <div className="mt-3 space-y-1 text-xs text-gray-400">
              {selectedIds.size !== 11 && <p>Need exactly 11 players ({selectedIds.size} selected)</p>}
              {captainCount !== 1 && <p>Select 1 Captain</p>}
              {viceCaptainCount !== 1 && <p>Select 1 Vice Captain</p>}
              {creditsUsed > maxCredits && <p className="text-red-400">Over budget by {creditsUsed - maxCredits} credits</p>}
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid}
            className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Submit Squad
          </button>
        </div>
      </div>
    </div>
  );
}
