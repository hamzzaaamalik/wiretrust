import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { Users, TrendingUp, Image, ShieldCheck, Wallet, ArrowRight } from 'lucide-react';

const features = [
  {
    title: 'Squad Challenge',
    desc: 'Pick your PSL XI and compete for sponsor prizes. Free to play.',
    icon: Users,
    color: 'text-secondary',
    bg: 'bg-secondary/8',
  },
  {
    title: 'Match Predictions',
    desc: 'Call the winner, top scorer or total runs. Earn points and badges.',
    icon: TrendingUp,
    color: 'text-primary-light',
    bg: 'bg-primary/8',
  },
  {
    title: 'NFT Rewards',
    desc: 'Earn tickets, player cards and fan experiences through challenges.',
    icon: Image,
    color: 'text-accent',
    bg: 'bg-accent/8',
  },
  {
    title: 'On-Chain Reputation',
    desc: 'Deploy AI agents with policy guardrails. Build verifiable trust.',
    icon: ShieldCheck,
    color: 'text-red-400',
    bg: 'bg-red-500/8',
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { connectMetaMask, connectGoogle, connected } = useWallet();
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (connected) {
      navigate('/', { replace: true });
    }
  }, [connected, navigate]);

  if (connected) return null;

  async function handleGoogleSignIn() {
    setLoading('google');
    setError(null);
    try {
      await connectGoogle();
      navigate('/');
    } catch (err) {
      setError(err.message || 'Sign-in failed');
    } finally {
      setLoading(null);
    }
  }

  async function handleMetaMask() {
    setLoading('metamask');
    setError(null);
    try {
      await connectMetaMask();
      navigate('/');
    } catch (err) {
      setError(err.message || 'MetaMask connection failed');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center px-4">
      {/* Background effects */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-primary/[0.06] blur-[100px]" />
        <div className="absolute bottom-1/3 left-1/4 w-[300px] h-[300px] rounded-full bg-secondary/[0.04] blur-[80px]" />
      </div>

      <div className="w-full max-w-md animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto mb-5">
            <span className="text-white font-bold text-lg">W</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
            Welcome to WireTrust
          </h1>
          <p className="text-sm text-zinc-500">
            PSL fan engagement protocol on WireFluid
          </p>
        </div>

        {/* Auth card */}
        <div className="card p-6 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <button
            onClick={handleGoogleSignIn}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-2.5 bg-white text-zinc-900 font-medium py-3 px-5 rounded-xl transition-all duration-200 hover:bg-zinc-100 active:scale-[0.98] disabled:opacity-50 text-sm"
          >
            {loading === 'google' ? (
              <span className="animate-spin w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            Sign in with Google
          </button>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 divider" />
            <span className="text-2xs text-zinc-600 uppercase tracking-wider">or</span>
            <div className="flex-1 divider" />
          </div>

          <button
            onClick={handleMetaMask}
            disabled={loading !== null}
            className="w-full btn-secondary py-3 flex items-center justify-center gap-2.5 disabled:opacity-50 text-sm"
          >
            {loading === 'metamask' ? (
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Wallet size={16} />
            )}
            Connect MetaMask
          </button>

          {error && (
            <div className="alert-error mt-4 text-center text-xs">
              {error}
            </div>
          )}
        </div>

        {/* Features */}
        <div className="mt-5 text-center animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <div className="grid grid-cols-2 gap-2.5">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="card-surface text-center py-4 px-3 animate-fade-in-up"
                style={{ animationDelay: `${250 + i * 60}ms` }}
              >
                <div className={`w-8 h-8 rounded-lg ${f.bg} flex items-center justify-center mx-auto mb-2`}>
                  <f.icon size={16} className={f.color} strokeWidth={1.5} />
                </div>
                <h4 className="text-xs font-medium text-zinc-300 mb-0.5">{f.title}</h4>
                <p className="text-2xs text-zinc-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
