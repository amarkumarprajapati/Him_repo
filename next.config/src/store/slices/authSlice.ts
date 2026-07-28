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
  readAuthCookiePayload,
} from '@/utils/auth-cookie';
import { fetchDevices } from './devicesSlice';
import type { PayloadAction } from '@reduxjs/toolkit';

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

export const restoreAuthSession = createAsyncThunk(
  'auth/restoreSession',
  async (_, { dispatch }) => {
    const payload = readAuthCookiePayload();
    if (!payload?.username || !payload?.role) {
      clearAuthCookie();
      return null;
    }

    if (payload.exp && payload.exp * 1000 <= Date.now()) {
      clearAuthCookie();
      return null;
    }

    const user: UserProfile = {
      username: payload.username,
      role: payload.role,
      is_staff: payload.role === 'SUPER_ADMIN',
      is_superuser: payload.role === 'SUPER_ADMIN',
    };

    dispatch(fetchDevices());
    return user;
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setAuthenticatedUser: (state, action: PayloadAction<UserProfile | null>) => {
      state.isAuthenticated = Boolean(action.payload);
      state.user = action.payload;
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
      })
      .addCase(restoreAuthSession.fulfilled, (state, action) => {
        state.isAuthenticated = Boolean(action.payload);
        state.user = action.payload;
      });
  },
});

export const { clearError, setAuthenticatedUser } = authSlice.actions;
export default authSlice.reducer;
