import React from 'react';
import { ExternalLink, Droplets } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-zinc-800/40 py-4 px-4 lg:px-6 mb-14 md:mb-0">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-600">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-[7px]">W</span>
            </div>
            <span className="text-zinc-500">WireTrust</span>
          </div>
          <span className="text-zinc-800">·</span>
          <span>
            Powered by{' '}
            <a href="https://wirefluid.com" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-primary-light transition-colors">
              WireFluid
            </a>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <a href="https://wirefluidscan.com" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors flex items-center gap-1">
            <ExternalLink size={10} />
            Explorer
          </a>
          <span className="text-zinc-800">·</span>
          <a href="https://wirefluid.com/faucet" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors flex items-center gap-1">
            <Droplets size={10} />
            Faucet
          </a>
          <span className="text-zinc-800">·</span>
          <span className="text-zinc-700 tabular-nums">WireFluid Testnet</span>
        </div>
      </div>
    </footer>
  );
}
