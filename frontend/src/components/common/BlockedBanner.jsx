import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

export default function BlockedBanner({ reason, scoreBefore, scoreAfter }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(timer);
  }, [reason, scoreBefore, scoreAfter]);

  if (!visible) return null;

  const diff = scoreAfter - scoreBefore;

  return (
    <div className="fixed top-16 left-0 right-0 z-40 animate-fade-in-down">
      <div className="bg-red-500/90 backdrop-blur-xl border-b border-red-400/30 px-4 py-3 shadow-lg shadow-red-500/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
          {/* Left: icon + reason */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
              <AlertCircle size={16} className="text-white" />
            </div>
            <div>
              <span className="text-white font-bold text-sm tracking-wide uppercase">
                Blocked
              </span>
              <span className="text-red-100 text-sm ml-2">
                {reason}
              </span>
            </div>
          </div>

          {/* Right: score change */}
          <div className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5">
            <span className="text-red-100 text-2xs font-medium uppercase tracking-wider mr-2">
              Score
            </span>
            <span className="text-white text-sm font-mono tabular-nums">
              {scoreBefore}
            </span>
            <span className="text-red-200/60 mx-1.5">&rarr;</span>
            <span className="text-white text-sm font-mono tabular-nums">
              {scoreAfter}
            </span>
            <span className={`text-2xs font-mono ml-1.5 ${diff > 0 ? 'text-emerald-300' : 'text-red-200'}`}>
              ({diff > 0 ? '+' : ''}{diff})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
