import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import {
  login,
  logout,
  profileFromLogin,
  type LoginPayload,
  type UserProfile,
} from '@/api/auth';
import {
  setAuthCookie,
  clearAuthCookie,
} from '@/utils/auth-cookie';
import { fetchDevices } from './devicesSlice';

interface AuthState {
  isAuthenticated: boolean;
  loading: boolean;
  error: unknown;
  user: UserProfile | null;
}

const initialState: AuthState = {
  isAuthenticated: false,
  loading: false,
  error: null,
  user: null,
};

function thunkError(err: unknown) {
  if (err && typeof err === 'object') {
    const maybe = err as { response?: { data?: unknown }; message?: string };
    return maybe.response?.data ?? maybe.message ?? 'Request failed';
  }
  return String(err);
}

export const loginUser = createAsyncThunk(
  'auth/login',
  async (payload: LoginPayload, { rejectWithValue, dispatch }) => {
    try {
      const data = await login(payload);
      if (!data.access_token) {
        throw new Error('No access token received.');
      }
      setAuthCookie(data.access_token, { maxAge: data.expires_in });

      const user = profileFromLogin(data);
      dispatch(fetchDevices());
      return { token: data.access_token, user };
    } catch (err: unknown) {
      return rejectWithValue(thunkError(err));
    }
  }
);

export const logoutUser = createAsyncThunk('auth/logout', async () => {
  try {
    await logout();
  } catch {
  }
  clearAuthCookie();
  return null;
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.isAuthenticated = false;
        state.user = null;
      });
  },
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer;
