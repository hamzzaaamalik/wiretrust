import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { BrowserProvider, formatEther } from 'ethers';
import { useWeb3Auth, useWeb3AuthConnect, useWeb3AuthDisconnect } from '@web3auth/modal/react';
import { useDispatch } from 'react-redux';
import { setWallet, setBalance as setReduxBalance, disconnectWallet } from '../store/slices/walletSlice';

const WIREFLUID_CHAIN_ID = 92533;
const WIREFLUID_CHAIN_ID_HEX = '0x16975';
const WIREFLUID_RPC = 'https://evm.wirefluid.com';
const STORAGE_KEY = 'wiretrust_wallet';

const WalletContext = createContext(null);

const initialState = {
  address: null,
  signer: null,
  provider: null,
  balance: null,
  connected: false,
  loading: false,
  chainId: null,
  walletType: null,
  ready: false,
};

export function WalletProvider({ children }) {
  const [state, setState] = useState(initialState);
  const metamaskReconnected = useRef(false);
  const dispatch = useDispatch();

  // Sync wallet state to Redux store whenever it changes
  useEffect(() => {
    if (state.connected && state.address) {
      dispatch(setWallet({
        address: state.address,
        balance: state.balance,
        chainId: state.chainId,
        walletType: state.walletType,
      }));
    } else if (!state.connected && state.ready) {
      dispatch(disconnectWallet());
    }
  }, [state.connected, state.address, state.balance, state.chainId, state.walletType, state.ready, dispatch]);

  // Web3Auth hooks
  const { isConnected: w3aConnected, provider: w3aProvider, isInitialized: w3aReady } = useWeb3Auth();
  const { connect: w3aConnect, loading: w3aLoading } = useWeb3AuthConnect();
  const { disconnect: w3aDisconnect } = useWeb3AuthDisconnect();

  // ── When Web3Auth connects/disconnects, sync to our state ──
  useEffect(() => {
    if (!w3aReady) return;

    if (w3aConnected && w3aProvider && state.walletType !== 'metamask') {
      // Web3Auth just connected - build ethers signer
      (async () => {
        try {
          const provider = new BrowserProvider(w3aProvider);
          const signer = await provider.getSigner();
          const address = await signer.getAddress();
          const balance = formatEther(await provider.getBalance(address));

          try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ type: 'web3auth' })); } catch {}

          setState({
            address, signer, provider, balance,
            connected: true, loading: false,
            chainId: WIREFLUID_CHAIN_ID, walletType: 'web3auth', ready: true,
          });
        } catch (err) {
          console.error('Web3Auth state sync error:', err);
          setState((prev) => ({ ...prev, ready: true }));
        }
      })();
    } else if (!w3aConnected && state.walletType === 'web3auth') {
      // Web3Auth disconnected
      setState({ ...initialState, ready: true });
    } else if (!w3aConnected && !state.connected) {
      // Not connected to anything - mark ready
      setState((prev) => ({ ...prev, ready: true }));
    }
  }, [w3aConnected, w3aProvider, w3aReady]);

  // ── Refresh balance ──
  const refreshBalance = useCallback(async () => {
    if (!state.provider || !state.address) return;
    try {
      const bal = await state.provider.getBalance(state.address);
      setState((prev) => ({ ...prev, balance: formatEther(bal) }));
    } catch (err) {
      console.error('Failed to refresh balance:', err);
    }
  }, [state.provider, state.address]);

  // ── Switch MetaMask to WireFluid ──
  const switchToWireFluid = useCallback(async () => {
    if (!window.ethereum) throw new Error('MetaMask not found');
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: WIREFLUID_CHAIN_ID_HEX }],
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: WIREFLUID_CHAIN_ID_HEX,
            chainName: 'WireFluid Testnet',
            rpcUrls: [WIREFLUID_RPC],
            nativeCurrency: { name: 'WIRE', symbol: 'WIRE', decimals: 18 },
            blockExplorerUrls: ['https://wirefluidscan.com'],
          }],
        });
      } else {
        throw switchError;
      }
    }
  }, []);

  // ── Connect with Google via Web3Auth ──
  const connectGoogle = useCallback(async () => {
    if (!w3aReady) {
      console.warn('Web3Auth not ready yet, please wait...');
      return;
    }
    if (w3aConnected) {
      console.warn('Already connected to Web3Auth');
      return;
    }
    setState((prev) => ({ ...prev, loading: true }));
    try {
      await w3aConnect();
      // State sync happens in the useEffect above
    } catch (err) {
      console.error('Google login error:', err);
      setState((prev) => ({ ...prev, loading: false }));
      throw err;
    }
  }, [w3aConnect, w3aReady, w3aConnected]);

  // ── Connect MetaMask ──
  const connectMetaMask = useCallback(async () => {
    if (!window.ethereum) throw new Error('MetaMask not found');
    setState((prev) => ({ ...prev, loading: true }));
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();

      if (Number(network.chainId) !== WIREFLUID_CHAIN_ID) {
        await switchToWireFluid();
      }

      const finalProvider = new BrowserProvider(window.ethereum);
      const signer = await finalProvider.getSigner();
      const address = await signer.getAddress();
      const balance = formatEther(await finalProvider.getBalance(address));

      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ type: 'metamask' })); } catch {}

      setState({
        address, signer, provider: finalProvider, balance,
        connected: true, loading: false,
        chainId: WIREFLUID_CHAIN_ID, walletType: 'metamask', ready: true,
      });
    } catch (err) {
      setState((prev) => ({ ...prev, loading: false, ready: true }));
      throw err;
    }
  }, [switchToWireFluid]);

  // ── Disconnect ──
  const disconnect = useCallback(async () => {
    if (state.walletType === 'web3auth') {
      try { await w3aDisconnect(); } catch (err) { console.error('W3A disconnect error:', err); }
    }
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setState({ ...initialState, ready: true });
  }, [state.walletType, w3aDisconnect]);

  // ── MetaMask auto-reconnect (once on mount) ──
  useEffect(() => {
    if (metamaskReconnected.current) return;
    metamaskReconnected.current = true;

    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch {}
    if (saved?.type !== 'metamask' || !window.ethereum) return;

    (async () => {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          const provider = new BrowserProvider(window.ethereum);
          const network = await provider.getNetwork();
          if (Number(network.chainId) !== WIREFLUID_CHAIN_ID) {
            try { await switchToWireFluid(); } catch { return; }
          }
          const finalProvider = new BrowserProvider(window.ethereum);
          const signer = await finalProvider.getSigner();
          const address = await signer.getAddress();
          const balance = formatEther(await finalProvider.getBalance(address));
          setState({
            address, signer, provider: finalProvider, balance,
            connected: true, loading: false,
            chainId: WIREFLUID_CHAIN_ID, walletType: 'metamask', ready: true,
          });
        }
      } catch (err) {
        console.error('MetaMask auto-reconnect failed:', err);
      }
    })();
  }, []);

  // ── MetaMask account/chain change listeners ──
  useEffect(() => {
    if (!window.ethereum || state.walletType !== 'metamask') return;
    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) disconnect();
    };
    const handleChainChanged = () => {
      if (state.connected) connectMetaMask().catch(console.error);
    };
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, [state.connected, state.walletType, connectMetaMask, disconnect]);

  const value = {
    ...state,
    connectGoogle,
    connectMetaMask,
    disconnect,
    switchToWireFluid,
    refreshBalance,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within a WalletProvider');
  return ctx;
}

export default WalletContext;
