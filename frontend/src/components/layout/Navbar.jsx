import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, TrendingUp, Award, BookOpen, Menu, X, Shield, Building2, Bot } from 'lucide-react';
import ConnectWallet from '../wallet/ConnectWallet';
import { useWallet } from '../../contexts/WalletContext';

const DEPLOYER = import.meta.env.VITE_DEPLOYER_ADDRESS?.toLowerCase();

function useNavLinks() {
  const { connected } = useWallet();
  return [
    { to: connected ? '/dashboard' : '/', label: connected ? 'Dashboard' : 'Home', icon: LayoutDashboard },
    { to: '/squad-challenge', label: 'Squad Challenge', icon: Users },
    { to: '/predict', label: 'Predictions', icon: TrendingUp },
    { to: '/marketplace', label: 'Challenges', icon: Award },
    { to: '/agents', label: 'AI Agents', icon: Bot },
    { to: '/learn', label: 'Learn', icon: BookOpen },
  ];
}

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { address } = useWallet();
  const navLinks = useNavLinks();
  const isAdmin = address && DEPLOYER && address.toLowerCase() === DEPLOYER;
  const [isFranchiseAdmin, setIsFranchiseAdmin] = useState(false);

  useEffect(() => {
    if (!address) { setIsFranchiseAdmin(false); return; }
    fetch('/api/franchise-portal/info', { headers: { 'x-wallet-address': address } })
      .then(r => { setIsFranchiseAdmin(r.ok); })
      .catch(() => setIsFranchiseAdmin(false));
  }, [address]);

  return (
    <>
      <nav className="sticky top-0 z-50 h-14 bg-dark-bg/80 backdrop-blur-xl border-b border-zinc-800/50 flex items-center px-4 lg:px-6">
        {/* Logo */}
        <div className="flex items-center gap-2 mr-8 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-xs">W</span>
          </div>
          <span className="text-sm font-semibold text-white tracking-tight">
            WireTrust
          </span>
          <span className="badge bg-zinc-800/80 text-zinc-500 text-2xs ml-0.5">TESTNET</span>
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-0.5 flex-1">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-1.5 ${
                  isActive
                    ? 'text-white bg-zinc-800/80'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
                }`
              }
            >
              <link.icon size={15} strokeWidth={1.75} />
              {link.label}
            </NavLink>
          ))}
          {isFranchiseAdmin && (
            <NavLink
              to="/franchise"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-1.5 ${
                  isActive
                    ? 'text-violet-300 bg-violet-500/10 border border-violet-500/20'
                    : 'text-violet-500/70 hover:text-violet-400 hover:bg-violet-500/10'
                }`
              }
            >
              <Building2 size={15} strokeWidth={1.75} />
              Franchise
            </NavLink>
          )}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 flex items-center gap-1.5 ${
                  isActive
                    ? 'text-amber-300 bg-amber-500/10 border border-amber-500/20'
                    : 'text-amber-500/70 hover:text-amber-400 hover:bg-amber-500/10'
                }`
              }
            >
              <Shield size={15} strokeWidth={1.75} />
              Admin
            </NavLink>
          )}
        </div>

        {/* Wallet */}
        <div className="hidden md:block ml-auto">
          <ConnectWallet />
        </div>

        {/* Mobile menu */}
        <button
          className="md:hidden ml-auto p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800/60 transition-colors"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        {menuOpen && (
          <div className="absolute top-14 left-0 right-0 bg-zinc-900/98 backdrop-blur-xl border-b border-zinc-800/50 md:hidden p-4 z-50 animate-fade-in-down">
            <ConnectWallet />
          </div>
        )}
      </nav>

      {/* Mobile bottom nav */}
      <div className="mobile-nav">
        <div className="flex items-center justify-around px-2 py-1">
          {navLinks.map((link) => {
            const isActive = link.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(link.to);
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={isActive ? 'mobile-nav-item-active' : 'mobile-nav-item'}
              >
                <link.icon size={18} strokeWidth={isActive ? 2 : 1.5} />
                <span className="text-2xs font-medium truncate">{link.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </>
  );
}
