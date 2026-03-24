import React, { useState, useEffect } from 'react';

export default function LiveMatchBanner() {
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchLive = async () => {
      try {
        const res = await fetch('/api/matches/live');
        if (!res.ok) throw new Error('No live match');
        const data = await res.json();
        if (!cancelled) setMatch(data);
      } catch {
        if (!cancelled) setMatch(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchLive();
    const interval = setInterval(fetchLive, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="card bg-gradient-to-r from-dark-surface to-dark-surface2 animate-pulse h-20 rounded-xl" />
    );
  }

  if (!match) {
    return (
      <div className="card bg-gradient-to-r from-dark-surface to-dark-surface2 rounded-xl text-center py-4">
        <span className="text-gray-500 text-sm">No live match</span>
      </div>
    );
  }

  return (
    <div className="card bg-gradient-to-r from-dark-surface via-primary/5 to-secondary/5 rounded-xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* Live indicator */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-success" />
          </span>
          <span className="text-success text-xs font-semibold uppercase tracking-wide">Live</span>
        </div>

        {/* Teams & score */}
        <div className="flex items-center gap-4 text-center flex-1 justify-center">
          <span className="text-white font-semibold text-lg">{match.team1}</span>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-white">{match.score}</span>
            {match.overs && (
              <span className="text-xs text-gray-500">({match.overs} ov)</span>
            )}
          </div>
          <span className="text-white font-semibold text-lg">{match.team2}</span>
        </div>

        {/* Current players */}
        <div className="text-right text-xs text-gray-400 space-y-1 min-w-[140px]">
          {(match.batting || match.battingTeam) && (
            <div>
              Batting: <span className="text-white">{match.batting || match.battingTeam}</span>
            </div>
          )}
          {match.currentBatsman && (
            <div>
              Bat: <span className="text-gray-300">{match.currentBatsman}</span>
            </div>
          )}
          {match.currentBowler && (
            <div>
              Bowl: <span className="text-gray-300">{match.currentBowler}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
