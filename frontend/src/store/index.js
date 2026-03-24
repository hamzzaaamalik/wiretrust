import { configureStore } from "@reduxjs/toolkit";
import walletReducer from "./slices/walletSlice";
import agentReducer from "./slices/agentSlice";
import matchReducer from "./slices/matchSlice";
import fantasyReducer from "./slices/fantasySlice";

export const store = configureStore({
  reducer: {
    wallet: walletReducer,
    agents: agentReducer,
    matches: matchReducer,
    fantasy: fantasyReducer,
  },
  devTools: import.meta.env.DEV,
});

export default store;
