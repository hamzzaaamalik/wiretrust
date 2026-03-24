import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

const API = import.meta.env.VITE_API_BASE_URL || "/api";

export const fetchAgents = createAsyncThunk(
  "agents/fetchAgents",
  async (ownerAddress, { rejectWithValue }) => {
    try {
      const res = await fetch(`${API}/agents/owner/${ownerAddress}`);
      if (!res.ok) throw new Error("Failed to fetch agents");
      return await res.json();
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const fetchAgentProfile = createAsyncThunk(
  "agents/fetchProfile",
  async (agentId, { rejectWithValue }) => {
    try {
      const res = await fetch(`${API}/agents/${agentId}`);
      if (!res.ok) throw new Error("Agent not found");
      return await res.json();
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const fetchLeaderboard = createAsyncThunk(
  "agents/fetchLeaderboard",
  async (_, { rejectWithValue }) => {
    try {
      const res = await fetch(`${API}/agents/leaderboard`);
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      return await res.json();
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

const agentSlice = createSlice({
  name: "agents",
  initialState: {
    list: [],
    profiles: {},      // agentId → profile data
    leaderboard: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearAgentError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchAgents
      .addCase(fetchAgents.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchAgents.fulfilled, (state, action) => { state.loading = false; state.list = action.payload; })
      .addCase(fetchAgents.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      // fetchAgentProfile
      .addCase(fetchAgentProfile.fulfilled, (state, action) => {
        const profile = action.payload;
        state.profiles[profile.agentId || profile.agent_id] = profile;
      })
      // fetchLeaderboard
      .addCase(fetchLeaderboard.fulfilled, (state, action) => { state.leaderboard = action.payload; });
  },
});

export const { clearAgentError } = agentSlice.actions;
export default agentSlice.reducer;
