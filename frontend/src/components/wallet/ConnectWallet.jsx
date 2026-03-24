import React, { useState, useRef, useEffect } from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { Wallet, LogOut, AlertTriangle, ChevronDown, Copy, Check, ExternalLink } from 'lucide-react';

const WIREFLUID_CHAIN_ID = 92533;

function shortenAddress(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function ConnectWallet() {
  const {
    address,
    balance,
    connected,
    loading,
    chainId,
    walletType,
    ready,
    connectMetaMask,
    connectGoogle,
    disconnect,
    switchToWireFluid,
  } = useWallet();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMetaMask = async () => {
    setError(null);
    try {
      await connectMetaMask();
      setDropdownOpen(false);
    } catch (err) {
      setError(err.message || 'Failed to connect MetaMask');
    }
  };

  const handleGoogle = async () => {
    setError(null);
    try {
      await connectGoogle();
      setDropdownOpen(false);
    } catch (err) {
      setError(err.message || 'Failed to sign in with Google');
    }
  };

  const handleCopy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Wrong network
  if (connected && chainId !== WIREFLUID_CHAIN_ID) {
    return (
      <button
        onClick={switchToWireFluid}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 text-amber-400 font-medium text-sm hover:bg-amber-500/15 border border-amber-500/20 hover:border-amber-500/30 transition-all duration-200"
      >
        <AlertTriangle size={14} />
        Switch Network
      </button>
    );
  }

  // Connected state
  if (connected && address) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen((prev) => !prev)}
          className="flex items-center gap-2 h-9 pl-3 pr-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700/50 hover:border-zinc-600/60 transition-all duration-200 text-sm group"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_6px_rgba(52,211,153,0.4)]" />
          <span className="font-mono text-zinc-200 text-xs group-hover:text-white transition-colors">
            {shortenAddress(address)}
          </span>
          {balance && (
            <>
              <span className="h-3.5 w-px bg-zinc-700/60 mx-0.5" />
              <span className="text-zinc-400 text-xs font-medium tabular-nums">
                {parseFloat(balance).toFixed(2)}
              </span>
              <span className="text-zinc-600 text-xs">WIRE</span>
            </>
          )}
          <ChevronDown
            size={13}
            className={`text-zinc-500 transition-transform duration-200 ml-0.5 ${dropdownOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 mt-2 w-56 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-xl shadow-2xl shadow-black/60 overflow-hidden z-50 animate-fade-in-down">
            {/* Wallet type label */}
            <div className="px-4 py-2.5 border-b border-zinc-800/60">
              <div className="flex items-center gap-2">
                {walletType === 'web3auth' ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" className="shrink-0">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                ) : (
                  <Wallet size={12} className="text-orange-400 shrink-0" />
                )}
                <span className="text-2xs text-zinc-400 font-medium">
                  {walletType === 'web3auth' ? 'Google Account' : 'MetaMask'}
                </span>
              </div>
            </div>

            {/* Copy address */}
            <button
              onClick={handleCopy}
              className="w-full text-left px-4 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors duration-150 flex items-center gap-2.5"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy Address'}
            </button>

            <div className="h-px bg-zinc-800/60" />

            {/* Disconnect */}
            <button
              onClick={() => {
                disconnect();
                setDropdownOpen(false);
              }}
              className="w-full text-left px-4 py-2.5 text-sm text-red-400/80 hover:text-red-400 hover:bg-red-500/5 transition-colors duration-150 flex items-center gap-2.5"
            >
              <LogOut size={14} />
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  // Not connected
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen((prev) => !prev)}
        disabled={loading || !ready}
        className="flex items-center gap-2 h-9 px-4 rounded-xl bg-primary text-white font-medium text-sm transition-all duration-200 hover:bg-primary-light hover:shadow-glow-sm active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-primary disabled:hover:shadow-none"
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <Wallet size={15} />
        )}
        {loading ? 'Connecting...' : 'Connect Wallet'}
      </button>

      {dropdownOpen && !loading && (
        <div className="absolute right-0 mt-2 w-64 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-xl shadow-2xl shadow-black/60 overflow-hidden z-50 animate-fade-in-down">
          {/* Header */}
          <div className="px-4 pt-3 pb-2">
            <p className="text-xs font-medium text-zinc-400">
              Connect your wallet
            </p>
          </div>

          <div className="h-px bg-zinc-800/60 mx-3" />

          {/* Options */}
          <div className="p-1.5 space-y-0.5">
            {/* Google */}
            <button
              onClick={handleGoogle}
              className="w-full text-left px-3 py-2.5 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition-all duration-150 flex items-center gap-3 rounded-lg group"
            >
              <span className="w-9 h-9 rounded-lg bg-white/[0.06] border border-white/[0.08] group-hover:border-white/[0.12] flex items-center justify-center shrink-0 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </span>
              <div className="min-w-0">
                <span className="block text-sm font-medium">Google</span>
                <span className="block text-2xs text-zinc-500 group-hover:text-zinc-400 transition-colors">No wallet needed</span>
              </div>
            </button>

            {/* MetaMask */}
            <button
              onClick={handleMetaMask}
              className="w-full text-left px-3 py-2.5 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition-all duration-150 flex items-center gap-3 rounded-lg group"
            >
              <span className="w-9 h-9 rounded-lg bg-orange-500/[0.08] border border-orange-500/[0.12] group-hover:border-orange-500/20 flex items-center justify-center shrink-0 transition-colors">
                <svg width="18" height="17" viewBox="0 0 35 33" fill="none">
                  <path d="M32.96 1L19.58 10.94l2.48-5.9L32.96 1z" fill="#E17726" stroke="#E17726" strokeWidth=".25" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M2.66 1l13.24 10.05-2.34-5.96L2.66 1zM28.23 23.53l-3.55 5.45 7.6 2.09 2.18-7.4-6.23-.14zM.92 23.67l2.17 7.4 7.58-2.09-3.54-5.45-6.21.14z" fill="#E27625" stroke="#E27625" strokeWidth=".25" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M10.33 14.51l-2.11 3.2 7.53.34-.26-8.1-5.16 4.56zM25.27 14.51l-5.23-4.67-.17 8.21 7.52-.34-2.12-3.2zM10.67 28.98l4.55-2.21-3.93-3.07-.62 5.28zM20.39 26.77l4.53 2.21-.61-5.28-3.92 3.07z" fill="#E27625" stroke="#E27625" strokeWidth=".25" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M24.92 28.98l-4.53-2.21.37 2.96-.04 1.25 4.2-1.99zM10.67 28.98l4.2 2-.03-1.25.36-2.96-4.53 2.21z" fill="#D5BFB2" stroke="#D5BFB2" strokeWidth=".25" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M14.96 22.04l-3.78-1.11 2.67-1.22 1.11 2.33zM20.64 22.04l1.11-2.33 2.68 1.22-3.79 1.11z" fill="#233447" stroke="#233447" strokeWidth=".25" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M10.67 28.98l.65-5.45-4.19.14 3.54 5.31zM24.29 23.53l.63 5.45 3.55-5.31-4.18-.14zM27.39 17.71l-7.52.34.7 3.99 1.11-2.33 2.68 1.22 3.03-3.22zM11.18 20.93l2.67-1.22 1.11 2.33.7-3.99-7.53-.34 3.05 3.22z" fill="#CC6228" stroke="#CC6228" strokeWidth=".25" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8.13 17.71l3.16 6.16-.11-3.05-3.05-3.11zM24.36 20.82l-.12 3.05 3.15-6.16-3.03 3.11zM15.66 18.05l-.7 3.99.88 4.56.2-6.01-.38-2.54zM19.87 18.05l-.37 2.53.18 6.02.9-4.56-.71-3.99z" fill="#E27525" stroke="#E27525" strokeWidth=".25" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <div className="min-w-0">
                <span className="block text-sm font-medium">MetaMask</span>
                <span className="block text-2xs text-zinc-500 group-hover:text-zinc-400 transition-colors">Browser extension</span>
              </div>
            </button>
          </div>

          {/* Error */}
          {error && (
            <>
              <div className="h-px bg-zinc-800/60 mx-3" />
              <div className="px-4 py-2.5 flex items-start gap-2">
                <AlertTriangle size={13} className="text-red-400 mt-0.5 shrink-0" />
                <span className="text-2xs text-red-400 leading-relaxed">{error}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
