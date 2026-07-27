import { apiClient } from './client';
import { ENDPOINTS } from './endpoints';

export interface TelemetryFile {
  filename: string;
  size: number;
  created_at: string;
  modified_at: string;
}

export interface TelemetryDeviceType {
  device_type: string;
  directory: string;
  files: TelemetryFile[];
  file_count: number;
}

export interface TelemetryStation {
  station_name: string;
  device_types: TelemetryDeviceType[];
  total_files: number;
}

export interface TelemetryFilesResponse {
  status: string;
  message: string;
  data: {
    stations: TelemetryStation[];
    total_files: number;
    total_stations: number;
  };
}

export async function listTelemetryFiles(): Promise<TelemetryFilesResponse['data']> {
  const { data } = await apiClient.get<TelemetryFilesResponse>(ENDPOINTS.telemetryFiles.list);
  return data.data;
}
