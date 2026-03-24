import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

const API = import.meta.env.VITE_API_BASE_URL || "/api";

export const fetchMatches = createAsyncThunk(
  "matches/fetchMatches",
  async (_, { rejectWithValue }) => {
    try {
      const res = await fetch(`${API}/matches`);
      if (!res.ok) throw new Error("Failed to fetch matches");
      const data = await res.json();
      return data.matches || data;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const fetchLiveMatches = createAsyncThunk(
  "matches/fetchLive",
  async (_, { rejectWithValue }) => {
    try {
      const res = await fetch(`${API}/matches/live`);
      if (!res.ok) throw new Error("Failed to fetch live matches");
      return await res.json();
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

const matchSlice = createSlice({
  name: "matches",
  initialState: {
    all: [],
    live: [],
    loading: false,
    error: null,
  },
  reducers: {
    updateMatchStatus(state, action) {
      const { matchId, status, result } = action.payload;
      const match = state.all.find((m) => m.match_id === matchId || m.matchId === matchId);
      if (match) {
        match.status = status;
        if (result) match.result = result;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMatches.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchMatches.fulfilled, (state, action) => { state.loading = false; state.all = action.payload; })
      .addCase(fetchMatches.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(fetchLiveMatches.fulfilled, (state, action) => { state.live = action.payload; });
  },
});

export const { updateMatchStatus } = matchSlice.actions;
export default matchSlice.reducer;
