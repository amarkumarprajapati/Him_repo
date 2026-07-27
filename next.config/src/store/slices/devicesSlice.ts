import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { listDevices, type DeviceItem } from '@/api/devices';

interface DevicesState {
  items: DeviceItem[];
  loading: boolean;
  error: string | null;
}

const initialState: DevicesState = {
  items: [],
  loading: false,
  error: null,
};

export const fetchDevices = createAsyncThunk(
  'devices/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const res = await listDevices();
      return res.results || [];
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch devices';
      return rejectWithValue(msg);
    }
  }
);

const devicesSlice = createSlice({
  name: 'devices',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDevices.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDevices.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchDevices.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export default devicesSlice.reducer;
