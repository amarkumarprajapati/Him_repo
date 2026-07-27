import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
  createSession,
  stopSession,
  getSyncStatus,
  listSessions,
  type CreateSessionPayload,
  type StopSessionPayload,
  type SessionFilters,
} from '@/api/sessions';

interface Session {
  id: string;
  name: string;
  status: string;
  masterId?: string;
  master_id?: string;
  nodes?: number;
  startedBy?: string;
  started_by?: string;
  session_type?: string;
  startTime?: string;
  start_time?: string;
  created_at?: string;
  session_id?: string;
  session_name?: string;
}

interface SessionState {
  sessions: Session[];
  currentSessionId: string | null;
  syncStatus: Record<string, unknown>;
  loading: boolean;
  error: string | null;
}

const initialState: SessionState = {
  sessions: [],
  currentSessionId: null,
  syncStatus: {},
  loading: false,
  error: null,
};

function thunkError(err: unknown, fallback: string) {
  if (err && typeof err === 'object') {
    const maybe = err as { response?: { data?: { detail?: string; message?: string } }; message?: string };
    return maybe.response?.data?.detail || maybe.response?.data?.message || maybe.message || fallback;
  }
  return fallback;
}

export const createNewSession = createAsyncThunk(
  'sessions/create',
  async (payload: CreateSessionPayload, { rejectWithValue }) => {
    try {
      return await createSession(payload);
    } catch (err: unknown) {
      return rejectWithValue(thunkError(err, 'Failed to create session'));
    }
  }
);

export const stopActiveSession = createAsyncThunk(
  'sessions/stop',
  async (payload: StopSessionPayload, { rejectWithValue }) => {
    try {
      return await stopSession(payload);
    } catch (err: unknown) {
      return rejectWithValue(thunkError(err, 'Failed to stop session'));
    }
  }
);

export const fetchSyncStatus = createAsyncThunk(
  'sessions/syncStatus',
  async (sessionId: string, { rejectWithValue }) => {
    try {
      return await getSyncStatus(sessionId);
    } catch (err: unknown) {
      return rejectWithValue(thunkError(err, 'Failed to fetch sync status'));
    }
  }
);

export const fetchSessions = createAsyncThunk(
  'sessions/list',
  async (filters: SessionFilters | undefined, { rejectWithValue }) => {
    try {
      const data = await listSessions(filters);
      return data;
    } catch (err: unknown) {
      return rejectWithValue(thunkError(err, 'Failed to fetch sessions'));
    }
  }
);

const sessionSlice = createSlice({
  name: 'sessions',
  initialState,
  reducers: {
    setCurrentSession: (state, action) => {
      state.currentSessionId = action.payload;
    },
    clearSessionError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createNewSession.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createNewSession.fulfilled, (state, action) => {
        state.loading = false;
        const id = action.payload.data?.session_id || action.payload.session_id || action.payload.id || '';
        if (id) {
          state.sessions.push({
            id,
            name: action.payload.data?.session_name || '',
            status: action.payload.data?.status || 'RUNNING',
          });
          state.currentSessionId = id;
        }
      })
      .addCase(createNewSession.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(stopActiveSession.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(stopActiveSession.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(stopActiveSession.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchSyncStatus.fulfilled, (state, action) => {
        state.syncStatus[action.meta.arg] = action.payload;
      })
      .addCase(fetchSessions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSessions.fulfilled, (state, action) => {
        state.loading = false;
        state.sessions = action.payload;
      })
      .addCase(fetchSessions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setCurrentSession, clearSessionError } = sessionSlice.actions;
export default sessionSlice.reducer;
