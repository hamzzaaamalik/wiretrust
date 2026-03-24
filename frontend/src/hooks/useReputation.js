import { useState, useEffect, useCallback } from 'react';
import { API } from '../utils/addresses.js';

export function useReputation(agentId) {
  const [score, setScore] = useState(null);
  const [badge, setBadge] = useState(null);
  const [checkpoint, setCheckpoint] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/agents/reputation/${agentId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data = await res.json();
      setScore(data.score ?? null);
      setBadge(data.badge ?? null);
      setCheckpoint(data.checkpoint ?? null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { score, badge, checkpoint, loading, error, refresh };
}

export default useReputation;
