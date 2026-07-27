import { apiClient } from './client';
import { ENDPOINTS } from './endpoints';

interface EventListResponse<T> {
  status: string;
  count: number;
  total_pages: number;
  current_page: number;
  results: T[];
}

interface EventSuccessResponse<T> {
  status: string;
  message?: string;
  data: T;
}

export type EventSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';

export interface EventItem {
  event_id: number | string;
  severity: EventSeverity | string;
  subsystem_type?: string;
  event_type?: string;
  acknowledged?: boolean;
  session_id?: string | null;
  message?: string;
  node_id?: string;
  timestamp?: string;
  created_at?: string;
}

function eventRows(value: unknown): EventItem[] {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  if (Array.isArray(value)) return value;
  if (Array.isArray(record.results)) return record.results as EventItem[];
  if (Array.isArray(record.data)) return record.data as EventItem[];
  if (record.data && typeof record.data === 'object') return [record.data as EventItem];
  return [];
}

export async function listEvents(params?: Record<string, string | boolean | number | undefined>): Promise<EventItem[]> {
  const cleanParams = Object.fromEntries(
    Object.entries(params || {}).filter(([, value]) => value !== undefined && value !== ''),
  );
  const { data } = await apiClient.get<EventListResponse<EventItem> | EventItem[]>(
    ENDPOINTS.events.list,
    { params: Object.keys(cleanParams).length > 0 ? cleanParams : undefined },
  );
  return eventRows(data);
}

export async function acknowledgeEvent(eventId: number | string, acknowledgedBy = 'admin') {
  const { data } = await apiClient.post<EventSuccessResponse<EventItem> | unknown>(
    ENDPOINTS.events.acknowledge,
    {
      event_id: Number(eventId),
      acknowledged_by: acknowledgedBy,
    },
  );
  return data;
}
