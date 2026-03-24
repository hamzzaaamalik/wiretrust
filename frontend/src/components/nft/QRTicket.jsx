import React from 'react';
import { ShieldCheck } from 'lucide-react';

function QRPlaceholder({ tokenId }) {
  return (
    <div className="mx-auto relative flex h-48 w-48 flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-700/60 bg-zinc-900/60">
      <div className="mb-2 grid grid-cols-5 gap-1">
        {Array.from({ length: 25 }).map((_, i) => {
          const filled = [0,1,2,3,4,5,9,10,14,15,19,20,21,22,23,24,6,8,12,16,18].includes(i);
          return (
            <div
              key={i}
              className={`h-3 w-3 rounded-sm ${filled ? 'bg-zinc-200' : 'bg-zinc-800'}`}
            />
          );
        })}
      </div>
      <span className="mt-1 text-2xs font-mono text-zinc-500">#{tokenId || '???'}</span>
      <span className="absolute inset-0 flex items-center justify-center text-2xl font-black text-amber-400/30 rotate-[-20deg] pointer-events-none select-none tracking-widest">DEMO</span>
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function QRTicket({ tokenId, name, eventDate, onClose }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-content max-w-sm text-center animate-fade-in-up">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 h-8 w-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800/80 transition-all text-lg"
            aria-label="Close"
          >
            &times;
          </button>
        )}

        <h2 className="section-title text-xl mb-5 justify-center">{name || 'Event Ticket'}</h2>

        <QRPlaceholder tokenId={tokenId} />

        {eventDate && (
          <p className="mt-4 text-sm text-zinc-300 font-medium">{formatDate(eventDate)}</p>
        )}

        <p className="mt-2 font-mono text-2xs text-zinc-600">Token ID: {tokenId}</p>

        {/* Instructions */}
        <div className="mt-5 bg-zinc-900/50 border border-zinc-800/60 rounded-xl px-4 py-3">
          <p className="text-sm text-zinc-400">Demo ticket. Venue verification coming soon.</p>
        </div>

        {/* Verified badge */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-2xs text-emerald-400">
          <ShieldCheck size={14} />
          <span className="font-medium">Verified on WireFluid</span>
        </div>
      </div>
    </div>
  );
}
