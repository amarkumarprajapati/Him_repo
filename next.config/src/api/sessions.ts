import { apiClient } from './client';
import { ENDPOINTS } from './endpoints';

export interface ApiSuccess<T> {
  status: string;
  message?: string;
  data: T;
}

export interface CreateSessionPayload {
  session_name: string;
  operation_mode?: 'LF' | string;
  node_id?: string;
  node_lat?: number;
  node_long?: number;
  polling_interval?: number;
  df_system_ip?: string;
  drone_detector_ip?: string;
  monitoring_system_ip?: string;
  cellular_active_ip?: string;
  cellular_passive_ip?: string;
  satellite_interception_ip?: string;
  remarks?: string;
}

export interface StopSessionPayload {
  session_id: string;
  stop_reason?: string;
}

export interface SessionDetail {
  session_id: string;
  session_name: string;
  status: 'CREATED' | 'RUNNING' | 'STOPPED' | string;
  operation_mode?: string;
  polling_interval?: number;
  start_time: string;
  stop_time?: string | null;
  created_by?: string;
  /* session details */
  session_type?: string;
  node_id?: string;
  node_lat?: number;
  node_long?: number;
  remarks?: string;
  export_status?: string;
  stop_reason?: string;
  last_sync_time?: string;
  /* subsystem IPs */
  drone_detector_ip?: string | null;
  cellular_active_ip?: string | null;
  cellular_passive_ip?: string | null;
  satellite_interception_ip?: string | null;
  df_system_ip?: string | null;
  monitoring_system_ip?: string | null;
  cognizant_ip?: string | null;
  cyronics_ip?: string | null;
  /* optional aliases returned by some endpoints */
  id?: string;
  name?: string;
  masterId?: string;
  master_id?: string;
  nodes?: number;
  startedBy?: string;
  started_by?: string;
  startTime?: string;
  created_at?: string;
}

export interface SessionResponse {
  status: string;
  message?: string;
  data?: SessionDetail;
  session_id?: string;
  id?: string;
}

export interface SessionFilters {
  session_id?: string;
  status?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
  limit?: number;
}

export interface SessionItem {
  id: string;
  name: string;
  masterId: string;
  nodes: number;
  startedBy: string;
  startTime: string;
  status: 'RUNNING' | 'STOPPED';
}

export interface SyncStatusResponse {
  device_reference_id?: string;
  subsystem_type?: string;
  sync_status: string;
  last_sync_timestamp: string | null;
  exported_records: number;
  csv_file_name?: string;
  destination_ip?: string;
  retry_count?: number;
  remarks?: string;
}

function stripEmpty<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== ''),
  ) as Partial<T>;
}

export async function createSession(payload: CreateSessionPayload): Promise<SessionResponse> {
  const body = stripEmpty({
    session_name: payload.session_name,
    operation_mode: payload.operation_mode || 'LF',
    node_id: payload.node_id,
    node_lat: payload.node_lat,
    node_long: payload.node_long,
    polling_interval: payload.polling_interval ?? 10,
    df_system_ip: payload.df_system_ip,
    drone_detector_ip: payload.drone_detector_ip,
    monitoring_system_ip: payload.monitoring_system_ip,
    cellular_active_ip: payload.cellular_active_ip,
    cellular_passive_ip: payload.cellular_passive_ip,
    satellite_interception_ip: payload.satellite_interception_ip,
    remarks: payload.remarks,
  });
  const { data } = await apiClient.post<SessionResponse>(ENDPOINTS.sessions.create, body);
  return data;
}

export async function stopSession(payload: StopSessionPayload): Promise<SessionResponse> {
  const { data } = await apiClient.post<SessionResponse>(ENDPOINTS.sessions.stop, payload);
  return data;
}

export async function getSessionStatus(sessionId?: string): Promise<SessionDetail> {
  const { data } = await apiClient.get<ApiSuccess<SessionDetail>>(
    ENDPOINTS.sessions.status,
    { params: sessionId ? { session_id: sessionId } : undefined },
  );
  return data.data;
}

export async function getSyncStatus(referenceId?: string): Promise<SyncStatusResponse> {
  const { data } = await apiClient.get<ApiSuccess<SyncStatusResponse>>(
    ENDPOINTS.sync.overview,
    { params: referenceId ? { session_id: referenceId } : undefined },
  );
  return data.data ?? (data as unknown as SyncStatusResponse);
}

export async function createsession(): Promise<SessionResponse> {
  const { data } = await apiClient.post<SessionResponse>(ENDPOINTS.sessions.create, {});
  return data;
}

function normalizeStatus(status?: string): 'RUNNING' | 'STOPPED' {
  return status === 'RUNNING' || status === 'CREATED' ? 'RUNNING' : 'STOPPED';
}

function mapSessionDetail(d: SessionDetail): SessionItem {
  return {
    id: d.session_id || d.id || '',
    name: d.session_name || d.name || '',
    masterId: d.masterId || d.master_id || 'COMMAND_POST',
    nodes: typeof d.nodes === 'number' ? d.nodes : 0,
    startedBy: d.created_by || d.startedBy || d.started_by || d.session_type || 'admin',
    startTime: d.start_time || d.startTime || d.created_at || '',
    status: normalizeStatus(d.status),
  };
}

interface PaginatedSessionResponse {
  count?: number;
  total_pages?: number;
  current_page?: number;
  results?: SessionDetail[];
}

export async function listSessions(filters?: SessionFilters): Promise<SessionItem[]> {
  const params = stripEmpty({
    session_id: filters?.session_id,
    status: filters?.status,
    search: filters?.search,
    date_from: filters?.date_from,
    date_to: filters?.date_to,
    page: filters?.page,
    page_size: filters?.page_size ?? filters?.limit,
  });

  const { data } = await apiClient.get<
    ApiSuccess<PaginatedSessionResponse | SessionDetail | SessionDetail[]> |
    PaginatedSessionResponse |
    SessionDetail |
    SessionDetail[]
  >(ENDPOINTS.sessions.list, { params });

  const response = data as unknown as Record<string, unknown>;

  const raw: unknown =
    response && typeof response === 'object' && 'data' in response
      ? response.data
      : response;

  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw.map(mapSessionDetail);
  }

  if (typeof raw === 'object' && raw !== null && 'results' in raw && Array.isArray((raw as Record<string, unknown>).results)) {
    return ((raw as Record<string, unknown>).results as SessionDetail[]).map(mapSessionDetail);
  }

  if (typeof raw === 'object' && raw !== null && 'session_id' in raw && (raw as Record<string, unknown>).session_id) {
    return [mapSessionDetail(raw as SessionDetail)];
  }

  return [];
}
