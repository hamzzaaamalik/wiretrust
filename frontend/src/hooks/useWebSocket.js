import { useState, useEffect, useRef, useCallback } from 'react';

const MAX_EVENTS = 50;
const MAX_BACKOFF = 30000;

function getWsUrl() {
  if (typeof window === 'undefined') return 'ws://localhost:3001/ws';
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  // In development, connect to backend directly
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return 'ws://localhost:3001/ws';
  }
  return `${protocol}//${host}/ws`;
}

export function useWebSocket() {
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const backoffRef = useRef(1000);
  const reconnectTimerRef = useRef(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const url = getWsUrl();
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setConnected(true);
      backoffRef.current = 1000; // Reset backoff on successful connection
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const data = JSON.parse(event.data);
        setEvents((prev) => {
          const updated = [data, ...prev];
          return updated.slice(0, MAX_EVENTS);
        });
      } catch (err) {
        console.error('WebSocket message parse error:', err);
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnected(false);
      // Reconnect with exponential backoff
      const delay = backoffRef.current;
      backoffRef.current = Math.min(delay * 2, MAX_BACKOFF);
      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      ws.close();
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { events, connected };
}

export default useWebSocket;
