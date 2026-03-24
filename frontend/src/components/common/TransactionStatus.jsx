import React from 'react';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function TransactionStatus({ status, txHash, onClose }) {
  if (!status) return null;

  return (
    <div className="modal-backdrop flex items-center justify-center animate-fade-in">
      <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-5 max-w-sm w-full mx-4 text-center space-y-5 animate-scale-in">
        {status === 'pending' && (
          <>
            <div className="flex justify-center pt-2">
              <div className="w-14 h-14 rounded-2xl bg-primary-light/10 border border-primary-light/10 flex items-center justify-center">
                <Loader2 size={28} className="animate-spin text-primary-light" />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-white font-medium">Confirming transaction</p>
              <p className="text-2xs text-zinc-500">Waiting for WireFluid network...</p>
            </div>
            <div className="flex justify-center gap-1 pt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-light/60 animate-pulse" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary-light/40 animate-pulse" style={{ animationDelay: '200ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-primary-light/20 animate-pulse" style={{ animationDelay: '400ms' }} />
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="flex justify-center pt-2">
              <div className="w-14 h-14 rounded-2xl bg-emerald-400/10 border border-emerald-400/10 flex items-center justify-center">
                <CheckCircle size={28} className="text-emerald-400" />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-white font-medium">Transaction confirmed</p>
              <p className="text-2xs text-zinc-500">Successfully processed on-chain</p>
            </div>
            {txHash && (
              <a
                href={`https://wirefluidscan.com/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary-light hover:text-primary-light/80 transition-colors duration-150"
              >
                View on WireFluidScan
                <span className="text-primary-light/50">&rarr;</span>
              </a>
            )}
          </>
        )}

        {status === 'error' && (
          <>
            <div className="flex justify-center pt-2">
              <div className="w-14 h-14 rounded-2xl bg-red-400/10 border border-red-400/10 flex items-center justify-center">
                <XCircle size={28} className="text-red-400" />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-red-400 font-medium">Transaction failed</p>
              {txHash && (
                <p className="text-zinc-500 text-2xs font-mono break-all leading-relaxed px-2">
                  {txHash}
                </p>
              )}
            </div>
          </>
        )}

        {status !== 'pending' && onClose && (
          <>
            <div className="h-px bg-zinc-800/60" />
            <button
              onClick={onClose}
              className="btn-secondary text-sm w-full"
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}
