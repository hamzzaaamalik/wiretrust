import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

function shortenAddress(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const BADGE_MAP = { 0: 'SAFE', 1: 'MEDIUM', 2: 'RISKY' };

function scoreColor(score) {
  if (score >= 70) return 'text-success';
  if (score >= 40) return 'text-warning';
  return 'text-error';
}

function badgeClass(badge) {
  const map = { SAFE: 'badge-safe', MEDIUM: 'badge-medium', RISKY: 'badge-risky' };
  return map[badge] || 'badge';
}

export default function AgentLeaderboard() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const res = await fetch('/api/agents/leaderboard');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setAgents(data.map((a, i) => ({
              id: a.agentId?.toString() || (i + 1).toString(),
              name: a.name,
              score: a.score,
              badge: BADGE_MAP[a.badge] ?? 'SAFE',
              owner: a.owner,
            })));
          }
        }
      } catch {}
      setLoading(false);
    }
    fetchLeaderboard();
  }, []);

  if (loading) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold text-white mb-4">Top Agents</h2>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center justify-between py-3">
              <div className="h-4 w-32 bg-zinc-800 rounded animate-pulse" />
              <div className="h-4 w-16 bg-zinc-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-white mb-4">Top Agents</h2>

      {agents.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-zinc-400 text-sm mb-1">No agents ranked yet</p>
          <p className="text-zinc-600 text-xs mb-3">Deploy the first agent and claim the top spot</p>
          <Link to="/create-agent" className="btn-primary text-sm px-4 py-2 inline-block">
            Create Agent
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-left border-b border-dark-border">
                <th className="pb-3 pr-4 font-medium">Rank</th>
                <th className="pb-3 pr-4 font-medium">Agent Name</th>
                <th className="pb-3 pr-4 font-medium">Score</th>
                <th className="pb-3 pr-4 font-medium">Badge</th>
                <th className="pb-3 font-medium">Owner</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {agents.map((agent, i) => (
                <tr key={agent.id} className="hover:bg-dark-surface2/50 transition-colors">
                  <td className="py-3 pr-4 text-gray-400 font-mono">{i + 1}</td>
                  <td className="py-3 pr-4">
                    <Link
                      to={`/agent/${agent.id}`}
                      className="text-white hover:text-primary transition-colors font-medium"
                    >
                      {agent.name}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`font-bold ${scoreColor(agent.score)}`}>{agent.score}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={badgeClass(agent.badge)}>{agent.badge}</span>
                  </td>
                  <td className="py-3 font-mono text-gray-400 text-xs">
                    {shortenAddress(agent.owner)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
