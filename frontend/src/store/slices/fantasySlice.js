import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

const API = import.meta.env.VITE_API_BASE_URL || "/api";

export const fetchContests = createAsyncThunk(
  "fantasy/fetchContests",
  async (_, { rejectWithValue }) => {
    try {
      const res = await fetch(`${API}/fantasy/all-contests`);
      if (!res.ok) throw new Error("Failed to fetch contests");
      return await res.json();
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const fetchPredictions = createAsyncThunk(
  "fantasy/fetchPredictions",
  async (address, { rejectWithValue }) => {
    try {
      const res = await fetch(`${API}/predictions/user/${address}`);
      if (!res.ok) throw new Error("Failed to fetch predictions");
      return await res.json();
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

const fantasySlice = createSlice({
  name: "fantasy",
  initialState: {
    contests: [],
    predictions: [],
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchContests.pending, (state) => { state.loading = true; })
      .addCase(fetchContests.fulfilled, (state, action) => { state.loading = false; state.contests = action.payload; })
      .addCase(fetchContests.rejected, (state, action) => { state.loading = false; state.error = action.payload; })
      .addCase(fetchPredictions.fulfilled, (state, action) => { state.predictions = action.payload; });
  },
});

export default fantasySlice.reducer;
