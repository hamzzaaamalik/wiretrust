import { createSlice } from "@reduxjs/toolkit";

const walletSlice = createSlice({
  name: "wallet",
  initialState: {
    address: null,
    balance: null,
    chainId: null,
    walletType: null, // "web3auth" | "metamask"
    connected: false,
    loading: false,
    ready: false,
  },
  reducers: {
    setWallet(state, action) {
      const { address, balance, chainId, walletType } = action.payload;
      state.address = address;
      state.balance = balance ?? state.balance;
      state.chainId = chainId ?? state.chainId;
      state.walletType = walletType ?? state.walletType;
      state.connected = !!address;
      state.loading = false;
      state.ready = true;
    },
    setBalance(state, action) {
      state.balance = action.payload;
    },
    setLoading(state, action) {
      state.loading = action.payload;
    },
    disconnectWallet(state) {
      state.address = null;
      state.balance = null;
      state.chainId = null;
      state.walletType = null;
      state.connected = false;
      state.loading = false;
    },
  },
});

export const { setWallet, setBalance, setLoading, disconnectWallet } = walletSlice.actions;
export default walletSlice.reducer;
