import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { listNotifications, markAsRead, markAllAsRead } from '@/api/notifications';
import type { NotificationItem } from '@/api/notifications';

interface NotificationState {
  notifications: NotificationItem[];
  loading: boolean;
  error: string | null;
}

const initialState: NotificationState = {
  notifications: [],
  loading: false,
  error: null,
};

export const fetchNotifications = createAsyncThunk(
  'notifications/fetchNotifications',
  async (params?: { category?: string; priority?: string; is_read?: boolean }) => {
    const data = await listNotifications(params);
    return data;
  }
);

export const readNotification = createAsyncThunk(
  'notifications/readNotification',
  async (notificationId: string) => {
    await markAsRead(notificationId);
    return notificationId;
  }
);

export const readAllNotifications = createAsyncThunk(
  'notifications/readAllNotifications',
  async () => {
    await markAllAsRead();
  }
);

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.notifications = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch notifications';
      })
      .addCase(readNotification.fulfilled, (state, action) => {
        const id = action.payload;
        const notif = state.notifications.find((n) => n.notification_id === id);
        if (notif) {
          notif.status = 'READ';
          notif.read_at = new Date().toISOString();
        }
      })
      .addCase(readAllNotifications.fulfilled, (state) => {
        state.notifications.forEach((n) => {
          n.status = 'READ';
          n.read_at = new Date().toISOString();
        });
      });
  },
});

export default notificationSlice.reducer;
