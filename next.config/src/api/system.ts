import { apiClient } from './client';
import { ENDPOINTS } from './endpoints';

export interface SystemHealthCpu {
  percent: number;
  count: number;
  frequency_mhz: number;
}

export interface SystemHealthMemory {
  total_mb: number;
  available_mb: number;
  used_mb: number;
  percent: number;
}

export interface SystemHealthSwap {
  total_mb: number;
  used_mb: number;
  percent: number;
}

export interface SystemHealthDisk {
  total_gb: number;
  used_gb: number;
  free_gb: number;
  percent: number;
}

export interface SystemHealthNetwork {
  bytes_sent: number;
  bytes_recv: number;
  packets_sent: number;
  packets_recv: number;
  interfaces: string[];
}

export interface SystemHealthResponse {
  timestamp?: string;
  cpu: SystemHealthCpu;
  memory: SystemHealthMemory;
  swap: SystemHealthSwap;
  disk: SystemHealthDisk;
  network: SystemHealthNetwork;
  boot_time: number;
}

interface SystemHealthApiWrapper {
  status: string;
  message?: string;
  data: SystemHealthResponse;
}

export async function getSystemHealth(): Promise<SystemHealthResponse> {
  const { data } = await apiClient.get<SystemHealthApiWrapper>(ENDPOINTS.system.health);
  return data.data;
}
