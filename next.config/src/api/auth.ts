import { apiClient } from './client';
import { ENDPOINTS } from './endpoints';

export interface LoginPayload {
  username: string;
  password: string;
}

export interface LoginResponse {
  status: string;
  access_token: string;
  role: 'SUPER_ADMIN' | 'COMMAND_OPERATOR' | 'FIELD_OPERATOR' | string;
  expires_in: number;
  username: string;
}

export interface UserProfile {
  username: string;
  role?: string;
  is_staff?: boolean;
  is_superuser?: boolean;
}

export function profileFromLogin(data: LoginResponse): UserProfile {
  return {
    username: data.username || '',
    role: data.role,
    is_staff: data.role === 'SUPER_ADMIN',
    is_superuser: data.role === 'SUPER_ADMIN',
  };
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>(ENDPOINTS.auth.login, payload);
  return data;
}

export async function logout(): Promise<unknown> {
  const { data } = await apiClient.post(ENDPOINTS.auth.logout);
  return data;
}
