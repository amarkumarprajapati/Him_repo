import { apiClient } from './client';
import { ENDPOINTS } from './endpoints';

export type DeviceType = 'DF' | 'NODE' | 'DRONE' | 'SATELLITE' | 'PASSIVE_CELL' | 'ACTIVE_CELL';
export type DeviceNetworkStatus = 'ONLINE' | 'OFFLINE';
export type DeviceHeartbeatStatus = 'ACTIVE' | 'INACTIVE';

export interface DeviceItem {
  device_id: string;
  device_type: DeviceType | string;
  ip_address: string;
  port: number | null;
  node_id: string | null;
  node_name: string | null;
  latitude: number;
  longitude: number;
  operating_status: string | null;
  master_device: string | null;
  heartbeat_status: DeviceHeartbeatStatus | string;
  network_status: DeviceNetworkStatus | string;
  status: string;
  csvrunning_status: number;
  station_name: string;
  quard_id?: number;
  telemetry_timestamp: string;
  created_at: string;
  updated_at: string;
  url?: string;
}

export interface DeviceFilters {
  device_type?: DeviceType;
  network_status?: DeviceNetworkStatus;
  heartbeat_status?: DeviceHeartbeatStatus;
  node_id?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface DeviceListResponse {
  status: string;
  count: number;
  total_pages: number;
  current_page: number;
  results: DeviceItem[];
}

export async function listDevices(filters?: DeviceFilters): Promise<DeviceListResponse> {
  const { data } = await apiClient.get<DeviceListResponse>(ENDPOINTS.devices.list, {
    params: filters,
  });
  return data;
}

export interface DeviceRegion {
  quard_id: number;
  device_count: number;
  devices: DeviceItem[];
}

export interface DeviceRegionsResponse {
  status: string;
  message: string;
  count: number;
  total_pages: number;
  current_page: number;
  results: DeviceRegion[];
}

export async function listDeviceRegions(): Promise<DeviceRegionsResponse> {
  const { data } = await apiClient.get<DeviceRegionsResponse>(ENDPOINTS.devices.regions);
  return data;
}

// ---------------------------------------------------------------------------
// Sensor Management
// ---------------------------------------------------------------------------

export interface SensorLocationsResponse {
  status: string;
  message: string;
  data: DeviceItem[];
}

export async function listSensorLocations(): Promise<SensorLocationsResponse> {
  const { data } = await apiClient.get<SensorLocationsResponse>(ENDPOINTS.devices.sensorLocations);
  return data;
}

export interface UpdateSensorLocationPayload {
  latitude?: number;
  longitude?: number;
}

export interface UpdateSensorLocationResponse {
  status: string;
  message: string;
  data: DeviceItem;
}

export interface UploadSensorLocationsResponse {
  status: string;
  message: string;
  data: {
    updated_count: number;
    failed_count: number;
    errors: Array<{
      row: number;
      message: string;
    }>;
  };
}

export async function updateSensorLocation(
  deviceId: string,
  payload: UpdateSensorLocationPayload,
): Promise<UpdateSensorLocationResponse> {
  const { data } = await apiClient.patch<UpdateSensorLocationResponse>(
    ENDPOINTS.devices.sensorLocationUpdate(deviceId),
    payload,
  );
  return data;
}

export async function uploadSensorLocations(
  file: File,
): Promise<UploadSensorLocationsResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const { data } = await apiClient.post<UploadSensorLocationsResponse>(
    ENDPOINTS.devices.sensorLocationsUpload,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  );
  return data;
}
