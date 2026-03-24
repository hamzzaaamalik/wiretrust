import React, { useState } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { Check, Copy, ExternalLink } from 'lucide-react';

function shortenAddress(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function WalletInfo() {
  const { address, balance, chainId } = useWallet();
  const [copied, setCopied] = useState(false);

  const copyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for unsupported clipboard API
    }
  };

  if (!address) return null;

  return (
    <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-2xs font-semibold text-zinc-500 uppercase tracking-wider">
          Wallet
        </h3>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
      </div>

      {/* Address row */}
      <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-3 flex items-center justify-between gap-2">
        <span className="font-mono text-zinc-300 text-sm tracking-wide">
          {shortenAddress(address)}
        </span>
        <button
          onClick={copyAddress}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800/60 transition-all duration-150"
          title="Copy address"
        >
          {copied ? (
            <Check size={14} className="text-emerald-400" />
          ) : (
            <Copy size={14} />
          )}
        </button>
      </div>

      {/* Info rows */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-500">Balance</span>
          <span className="text-white font-medium tabular-nums">
            {balance ? `${parseFloat(balance).toFixed(4)} WIRE` : '--'}
          </span>
        </div>

        <div className="h-px bg-zinc-800/60" />

        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-500">Chain ID</span>
          <span className="text-zinc-400 font-mono text-2xs tabular-nums">
            {chainId ?? '--'}
          </span>
        </div>
      </div>

      {/* Explorer link */}
      <div className="h-px bg-zinc-800/60" />

      <a
        href={`https://wirefluidscan.com/address/${address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-1.5 text-2xs text-primary-light hover:text-primary-light/80 transition-colors duration-150 pt-0.5 group"
      >
        View on WireFluidScan
        <ExternalLink size={11} className="opacity-60 group-hover:opacity-100 transition-opacity" />
      </a>
    </div>
  );
}
