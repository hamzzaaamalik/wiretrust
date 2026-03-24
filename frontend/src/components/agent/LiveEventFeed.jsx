import React from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';

function borderColor(event) {
  const type = event.type || event.status;
  if (type === 'success' || type === 'execution') return 'border-l-success';
  if (type === 'violation' || type === 'blocked') return 'border-l-error';
  if (type === 'failure' || type === 'error') return 'border-l-warning';
  return 'border-l-gray-500';
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function LiveEventFeed() {
  const { events, connected } = useWebSocket();

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Live Events</h2>
        <span className={`flex items-center gap-1.5 text-xs ${connected ? 'text-success' : 'text-gray-500'}`}>
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-success' : 'bg-gray-500'}`} />
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      <div className="max-h-96 overflow-y-auto space-y-1">
        {events.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">No events yet</div>
        ) : (
          events.map((event, i) => (
            <div
              key={event.id || i}
              className={`border-l-4 ${borderColor(event)} bg-dark-bg rounded-r-lg px-3 py-2 flex items-center justify-between gap-2`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-mono text-gray-500 shrink-0">
                  {event.type || 'event'}
                </span>
                <span className="text-sm text-gray-300 truncate">
                  {event.agentName || event.agentId || '--'}
                </span>
                <span className="text-sm text-white truncate">{event.action || ''}</span>
              </div>
              <span className="text-xs text-gray-500 shrink-0">
                {formatTime(event.timestamp)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
