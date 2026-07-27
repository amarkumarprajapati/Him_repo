import { apiClient } from './client';
import { ENDPOINTS } from './endpoints';

export interface NotificationItem {
  notification_id: string;
  title: string;
  message: string;
  category: string;
  priority: string;
  status: 'UNREAD' | 'READ';
  session_id: string | null;
  session_name: string | null;
  action_type: string;
  triggered_by: string;
  created_at: string;
  read_at: string | null;
}

interface NotificationListResponse {
  status: string;
  count?: number;
  results?: NotificationItem[];
}

function normalizeList(data: unknown): NotificationItem[] {
  if (Array.isArray(data)) return data;
  const record = data as Record<string, unknown>;
  if (Array.isArray(record?.results)) return record.results as NotificationItem[];
  if (Array.isArray(record?.data)) return record.data as NotificationItem[];
  return [];
}

export async function listNotifications(params?: {
  category?: string;
  priority?: string;
  is_read?: boolean;
}): Promise<NotificationItem[]> {
  const { data } = await apiClient.get<NotificationListResponse>(ENDPOINTS.notifications.list, {
    params,
  });
  return normalizeList(data);
}

export async function getNotification(notificationId: string): Promise<NotificationItem> {
  const { data } = await apiClient.get<{ status: string; data: NotificationItem }>(
    ENDPOINTS.notifications.detail(notificationId),
  );
  return data.data ?? (data as unknown as NotificationItem);
}

export async function markAsRead(notificationId: string): Promise<void> {
  await apiClient.post(ENDPOINTS.notifications.markRead(notificationId));
}

export async function markAllAsRead(): Promise<void> {
  await apiClient.post(ENDPOINTS.notifications.markAllRead);
}
