import { API_BASE_URL, apiClient } from './client';
import { ENDPOINTS } from './endpoints';

export type ExportModule =
  | 'DF'
  | 'MONITORING'
  | 'DRONE';

export interface ExportCsvPayload {
  session_id: string;
  module: ExportModule;
  selected_fields?: string[];
  destination_ip?: string;
}

export interface ExportCsvResponse {
  status: string;
  message?: string;
  data?: {
    csv_file_name?: string;
    csv_file?: string;
    download_url?: string;
    exported_records?: number;
    destination_ip?: string;
  };
  csv_file?: string;
  download_url?: string;
}

export async function exportCsv(
  sessionId: string,
  module: ExportModule = 'DF',
  selectedFields?: string[],
  destinationIp?: string,
): Promise<ExportCsvResponse> {
  const payload: ExportCsvPayload = {
    session_id: sessionId,
    module,
    selected_fields: selectedFields,
    destination_ip: destinationIp,
  };
  const { data } = await apiClient.post<ExportCsvResponse>(ENDPOINTS.export.csv, payload);
  return data;
}


export function backendOrigin() {
  try {
    const url = new URL(API_BASE_URL);
    url.pathname = url.pathname.replace(/\/api\/?$/, '');
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return API_BASE_URL.replace(/\/api\/?$/, '').replace(/\/+$/, '');
  }
}

export function downloadFile(url: string, filename: string) {
  const fullUrl = url.startsWith('/') ? `${backendOrigin()}${url}` : url;

  const link = document.createElement('a');
  link.href = fullUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
