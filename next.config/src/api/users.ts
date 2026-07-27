import { apiClient } from './client';
import { ENDPOINTS } from './endpoints';

export interface UserItem {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  assigned_node_id: string | null;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

interface UserListResponse {
  status?: string;
  count?: number;
  results?: UserItem[];
  data?: UserItem[];
}

function normalizeList(data: unknown): UserItem[] {
  if (Array.isArray(data)) return data as UserItem[];
  const record = data as Record<string, unknown>;
  if (Array.isArray(record?.results)) return record.results as UserItem[];
  if (Array.isArray(record?.data)) return record.data as UserItem[];
  return [];
}

export async function listUsers(): Promise<UserItem[]> {
  const { data } = await apiClient.get<UserListResponse | UserItem[]>(
    ENDPOINTS.users.list,
  );
  return normalizeList(data);
}

export async function getUserDetail(userId: number | string): Promise<UserItem> {
  const { data } = await apiClient.get<{ status?: string; data?: UserItem } | UserItem>(
    ENDPOINTS.users.detail(userId),
  );
  if (data && typeof data === 'object' && 'data' in data && data.data) {
    return data.data;
  }
  return data as UserItem;
}

export async function createUser(payload: Partial<UserItem> & { password?: string }): Promise<UserItem> {
  const { data } = await apiClient.post<{ status?: string; data?: UserItem } | UserItem>(
    ENDPOINTS.users.list,
    payload
  );
  if (data && typeof data === 'object' && 'data' in data && data.data) {
    return data.data;
  }
  return data as UserItem;
}

export async function updateUser(userId: number | string, payload: Partial<UserItem> & { password?: string }): Promise<UserItem> {
  const { data } = await apiClient.patch<{ status?: string; data?: UserItem } | UserItem>(
    ENDPOINTS.users.detail(userId),
    payload
  );
  if (data && typeof data === 'object' && 'data' in data && data.data) {
    return data.data;
  }
  return data as UserItem;
}

export async function deleteUser(userId: number | string): Promise<unknown> {
  const { data } = await apiClient.delete(ENDPOINTS.users.detail(userId));
  return data;
}
