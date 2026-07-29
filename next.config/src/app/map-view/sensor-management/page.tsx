'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/store/hooks';
import { Antenna, Check, Drone, MapPin, Orbit, Pencil, Plus, Radio, RadioTower, RefreshCw, Shield, Trash2, Wifi, WifiOff, X } from 'lucide-react';
import {
  listSensorLocations,
  updateDevice,
  getDeviceTypes,
  addDevice,
  deleteDevice,
  type DeviceItem,
  type AddDevicePayload,
} from '@/api/devices';
import { ConfirmDialog } from '@/components/modal/confirm-dialog';
import { showToast } from '@/utils/toast';

const DEVICE_TYPE_LABELS: Record<string, string> = {
  ACTIVE_CELL: 'Active Cellular',
  PASSIVE_CELL: 'Passive Cellular',
  SATELLITE: 'Satellite Interceptor',
};

const DEVICE_TYPE_COLORS: Record<string, string> = {
  ACTIVE_CELL: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  PASSIVE_CELL: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
  SATELLITE: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
};

const DEVICE_TYPE_META: Record<
  string,
  {
    icon: typeof MapPin;
    iconWrap: string;
    iconColor: string;
  }
> = {
  ACTIVE_CELL: {
    icon: Antenna,
    iconWrap: 'bg-emerald-500/12 border border-emerald-500/20',
    iconColor: 'text-emerald-400',
  },
  PASSIVE_CELL: {
    icon: RadioTower,
    iconWrap: 'bg-rose-500/12 border border-rose-500/20',
    iconColor: 'text-rose-400',
  },
  SATELLITE: {
    icon: Orbit,
    iconWrap: 'bg-violet-500/12 border border-violet-500/20',
    iconColor: 'text-violet-400',
  },
  DRONE: {
    icon: Drone,
    iconWrap: 'bg-amber-500/12 border border-amber-500/20',
    iconColor: 'text-amber-400',
  },
  DF: {
    icon: Radio,
    iconWrap: 'bg-sky-500/12 border border-sky-500/20',
    iconColor: 'text-sky-400',
  },
  MONITORING_SENSOR: {
    icon: Shield,
    iconWrap: 'bg-cyan-500/12 border border-cyan-500/20',
    iconColor: 'text-cyan-400',
  },
};

const FALLBACK_DEVICE_META = {
  icon: MapPin,
  iconWrap: 'bg-slate-500/12 border border-slate-500/20',
  iconColor: 'text-slate-400',
};


const COORD_EDIT_TYPES = new Set(['PASSIVE_CELL', 'ACTIVE_CELL', 'SATELLITE']);
const STATION_EDIT_TYPES = new Set(['MONITORING_SENSOR', 'DRONE', 'DF']);

function getDeviceMeta(deviceType: string) {
  return DEVICE_TYPE_META[deviceType] ?? FALLBACK_DEVICE_META;
}



interface EditState {
  deviceId: string;
  deviceType: string;
  deviceName: string;
  networkStatus: string;
  ip_address: string;
  latitude: string;
  longitude: string;
  station_name: string;
  saving: boolean;
}

const MONITORING_DRONE_DF_TYPES = new Set(['MONITORING_SENSOR', 'DRONE', 'DF']);
const COORD_CELL_SATELLITE_TYPES = new Set(['PASSIVE_CELL', 'ACTIVE_CELL', 'SATELLITE']);
const NODE_REQUIRED_TYPES = COORD_CELL_SATELLITE_TYPES;

interface AddDeviceState {
  open: boolean;
  loading: boolean;
  submitting: boolean;
  deviceTypes: string[];
  form: {
    device_type: string;
    ip_address: string;
    port: string;
    node_id: string;
    node_name: string;
    latitude: string;
    longitude: string;
    station_name: string;
  };
}

const initialAddDeviceForm = {
  device_type: '',
  ip_address: '',
  port: '',
  node_id: '',
  node_name: '',
  latitude: '',
  longitude: '',
  station_name: '',
};

export default function SensorManagementPage() {
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(10);
  const [deleteTarget, setDeleteTarget] = useState<DeviceItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [addDeviceState, setAddDeviceState] = useState<AddDeviceState>({
    open: false,
    loading: false,
    submitting: false,
    deviceTypes: [],
    form: { ...initialAddDeviceForm },
  });

  const isInitialLoading = loading && devices.length === 0;


  useEffect(() => {
    if (user && user.role !== 'SUPER_ADMIN') {
      router.replace('/map-view');
    }
  }, [user, router]);

  const fetchDevices = useCallback(async (page: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await listSensorLocations(page, pageSize);
      const deviceData = res.results ?? res.data ?? [];
      setDevices(deviceData);
      setTotalPages(res.total_pages ?? 1);
      setTotalCount(res.count ?? deviceData.length);
      setCurrentPage(page);
    } catch {
      setError('Failed to load sensor devices.');
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchDevices(1);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchDevices]);

  useEffect(() => {
    if (!edit) return;

    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [edit]);

  const startEdit = (device: DeviceItem) => {
    setEdit({
      deviceId: device.device_id,
      deviceType: device.device_type,
      deviceName: device.node_name ?? device.station_name ?? device.device_type,
      networkStatus: device.network_status ?? 'OFFLINE',
      ip_address: device.ip_address ?? '',
      latitude: device.latitude != null ? String(device.latitude) : '',
      longitude: device.longitude != null ? String(device.longitude) : '',
      station_name: device.station_name ?? '',
      saving: false,
    });
  };

  const cancelEdit = () => setEdit(null);

  const confirmDeleteSensor = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await deleteDevice(deleteTarget.device_id);
      showToast.success('Sensor deleted successfully.');
      setDeleteTarget(null);
      const nextPage = devices.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
      await fetchDevices(nextPage);
    } catch {
      showToast.error('Failed to delete sensor.');
    } finally {
      setDeleting(false);
    }
  };

  const saveEdit = async () => {
    if (!edit) return;
    const isCoordType = COORD_EDIT_TYPES.has(edit.deviceType);
    const isStationType = STATION_EDIT_TYPES.has(edit.deviceType);

    if (!edit.ip_address.trim()) {
      showToast.error('IP address is required.');
      return;
    }

    const payload: { ip_address?: string; latitude?: number; longitude?: number; station_name?: string } = {
      ip_address: edit.ip_address.trim(),
    };

    if (isCoordType) {
      const lat = parseFloat(edit.latitude);
      const lng = parseFloat(edit.longitude);
      if (!edit.latitude.trim() || isNaN(lat) || lat < -90 || lat > 90) {
        showToast.error('Latitude is required and must be a number between -90 and 90.');
        return;
      }
      if (!edit.longitude.trim() || isNaN(lng) || lng < -180 || lng > 180) {
        showToast.error('Longitude is required and must be a number between -180 and 180.');
        return;
      }
      payload.latitude = lat;
      payload.longitude = lng;
    } else if (isStationType) {
      if (!edit.station_name.trim()) {
        showToast.error('Station name is required.');
        return;
      }
      payload.station_name = edit.station_name.trim();
    }

    setEdit((prev) => prev && { ...prev, saving: true });
    try {
      await updateDevice(edit.deviceId, payload);
      showToast.success('Device updated successfully.');
      setEdit(null);
      await fetchDevices(currentPage);
    } catch (err) {
      showToast.error(getApiErrorMessage(err, 'Failed to update device.'));
      setEdit((prev) => prev && { ...prev, saving: false });
    }
  };

  if (user?.role !== 'SUPER_ADMIN') return null;

  const closeAddDevice = () => {
    if (addDeviceState.submitting) return;
    setAddDeviceState({
      open: false,
      loading: false,
      submitting: false,
      deviceTypes: [],
      form: { ...initialAddDeviceForm },
    });
  };

  const updateAddForm = (field: keyof typeof initialAddDeviceForm, value: string) => {
    setAddDeviceState((prev) => ({
      ...prev,
      form: {
        ...prev.form,
        [field]: value,
        ...(field === 'device_type' && MONITORING_DRONE_DF_TYPES.has(value)
          ? { node_id: '', node_name: '', station_name: '' }
          : {}),
      },
    }));
  };

  const submitAddDevice = async () => {
    const { form } = addDeviceState;
    const deviceType = form.device_type.trim();

    if (!deviceType) {
      showToast.error('Device type is required.');
      return;
    }
    if (!form.ip_address.trim()) {
      showToast.error('IP address is required.');
      return;
    }

    const port = parseInt(form.port, 10);
    if (!form.port.trim() || isNaN(port) || port < 1 || port > 65535) {
      showToast.error('Port is required and must be a number between 1 and 65535.');
      return;
    }

    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    if (!form.latitude.trim() || isNaN(lat) || lat < -90 || lat > 90) {
      showToast.error('Latitude is required and must be between -90 and 90.');
      return;
    }
    if (!form.longitude.trim() || isNaN(lng) || lng < -180 || lng > 180) {
      showToast.error('Longitude is required and must be between -180 and 180.');
      return;
    }

    const requiresNodeDetails = NODE_REQUIRED_TYPES.has(deviceType);
    if (requiresNodeDetails && !form.node_id.trim()) {
      showToast.error('Node ID is required for this device type.');
      return;
    }
    if (requiresNodeDetails && !/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9_-]+$/.test(form.node_id.trim())) {
      showToast.error('Node ID must contain letters and numbers.');
      return;
    }
    if (requiresNodeDetails && !form.node_name.trim()) {
      showToast.error('Node name is required for this device type.');
      return;
    }
    if (requiresNodeDetails && !form.station_name.trim()) {
      showToast.error('Station name is required for this device type.');
      return;
    }
    const payload: AddDevicePayload = {
      device_type: deviceType,
      ip_address: form.ip_address.trim(),
      port,
      latitude: lat,
      longitude: lng,
      csvrunning_status: 0,
      quard_id: 0,
    };

    if (form.node_id.trim()) payload.node_id = form.node_id.trim();
    if (form.node_name.trim()) payload.node_name = form.node_name.trim();
    if (form.station_name.trim()) payload.station_name = form.station_name.trim();

    setAddDeviceState((prev) => ({ ...prev, submitting: true }));
    try {
      await addDevice(payload);
      showToast.success('Device added successfully.');
      closeAddDevice();
      await fetchDevices(1);
    } catch (err) {
      showToast.error(getApiErrorMessage(err, 'Failed to add device.'));
      setAddDeviceState((prev) => ({ ...prev, submitting: false }));
    }
  };

  function getApiErrorMessage(err: unknown, fallback: string): string {

    const data = (err as any)?.response?.data;
    if (!data) return fallback;
    if (data.message && typeof data.message === 'object' && !Array.isArray(data.message)) {
      const parts: string[] = [];
      for (const [field, msgs] of Object.entries(data.message)) {
        if (Array.isArray(msgs)) {
          parts.push(...msgs.map((m) => String(m)));
        } else if (msgs) {
          parts.push(String(msgs));
        }
      }
      if (parts.length) return parts.join(' ');
    }


    if (typeof data.message === 'string' && data.message.trim()) {
      return data.message;
    }


    if (typeof data.detail === 'string') return data.detail;
    if (typeof data.error === 'string') return data.error;

    return fallback;
  }

  return (
    <div className="flex flex-col h-screen p-6 gap-4 overflow-hidden bg-slate-50 dark:bg-[#0f172a]">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <MapPin className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Sensor Management</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Update latitude &amp; longitude for cellular and satellite sensors
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setAddDeviceState((prev) => ({ ...prev, open: true, loading: true }));
            getDeviceTypes()
              .then((res) => {
                setAddDeviceState((prev) => ({
                  ...prev,
                  loading: false,
                  deviceTypes: res.data.device_types,
                }));
              })
              .catch(() => {
                setAddDeviceState((prev) => ({ ...prev, open: false, loading: false }));
                showToast.error('Failed to load device types.');
              });
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-600"
        >
          <Plus className="h-4 w-4" />
          Add Device
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {isInitialLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-200 dark:bg-white/5 animate-pulse" />
          ))}
        </div>
      )}

      {/* Device table */}
      <div className="flex flex-col flex-1 min-h-0">
        <div className="relative flex-1 min-h-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-[#1e293b]/60 shadow-sm">
          <div className="h-full overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-[#1e293b]">
                <tr className="border-b border-slate-200 dark:border-white/8 bg-slate-50 dark:bg-[#1e293b]">
                  <th className="sticky top-0 bg-slate-50 px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-[#1e293b] dark:text-slate-400">
                    Device Type
                  </th>
                  <th className="sticky top-0 bg-slate-50 px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-[#1e293b] dark:text-slate-400">
                    Network Status
                  </th>
                  <th className="sticky top-0 bg-slate-50 px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-[#1e293b] dark:text-slate-400">
                    Station Name
                  </th>
                  <th className="sticky top-0 bg-slate-50 px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-[#1e293b] dark:text-slate-400">
                    IP Address
                  </th>
                  <th className="sticky top-0 bg-slate-50 px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-[#1e293b] dark:text-slate-400">
                    Latitude
                  </th>
                  <th className="sticky top-0 bg-slate-50 px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-[#1e293b] dark:text-slate-400">
                    Longitude
                  </th>
                  <th className="sticky top-0 bg-slate-50 px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-[#1e293b] dark:text-slate-400">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {!loading && devices.length === 0 && !error && (
                  <tr>
                    <td colSpan={7} className="px-5 py-20">
                      <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                        <MapPin className="h-10 w-10 mb-3 opacity-30" />
                        <p className="text-sm">No sensor devices found.</p>
                      </div>
                    </td>
                  </tr>
                )}
                {devices.map((device) => {
                  const typeLabel = DEVICE_TYPE_LABELS[device.device_type] ?? device.device_type;
                  const isOnline = device.network_status === 'ONLINE';
                  const meta = getDeviceMeta(device.device_type);
                  const DeviceIcon = meta.icon;

                  return (
                    <tr
                      key={device.device_id}
                      className="transition-colors hover:bg-slate-50 dark:hover:bg-white/3"
                    >
                      {/* Device type */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-start gap-3 min-w-[220px]">
                          <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.iconWrap}`}>
                            <DeviceIcon className={`h-4.5 w-4.5 ${meta.iconColor}`} />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-slate-900 dark:text-white truncate">{typeLabel}</div>
                            <div className="text-xs text-slate-400 font-mono mt-0.5 break-all">
                              {device.device_id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Network status */}
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${isOnline ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                          {device.network_status ?? '—'}
                        </span>
                      </td>

                      {/* Station name */}
                      <td className="px-5 py-3.5">
                        <div className="min-w-[160px] text-sm font-medium text-slate-800 dark:text-slate-100">
                          {device.station_name ?? '—'}
                        </div>
                      </td>

                      {/* IP address */}
                      <td className="px-5 py-3.5">
                        <div className="min-w-[180px] font-mono text-slate-700 dark:text-slate-300 break-all">
                          {device.ip_address ?? '—'}
                        </div>
                      </td>

                      {/* Latitude */}
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {device.latitude != null ? device.latitude : '—'}
                        </span>
                      </td>

                      {/* Longitude */}
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {device.longitude != null ? device.longitude : '—'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => startEdit(device)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            {/* Edit */}
                          </button>
                          <button
                            onClick={() => setDeleteTarget(device)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-500 transition-colors hover:bg-red-500/15 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                            aria-label="Delete sensor"
                            title="Delete sensor"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 shrink-0 flex items-center justify-between px-4 py-3 bg-white dark:bg-[#1e293b]/60 border border-slate-200 dark:border-white/8 rounded-xl">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Showing <span className="font-medium text-slate-900 dark:text-white">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-medium text-slate-900 dark:text-white">
                {Math.min(currentPage * pageSize, totalCount)}
              </span>{' '}
              of <span className="font-medium text-slate-900 dark:text-white">{totalCount}</span> results
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchDevices(currentPage - 1)}
                disabled={currentPage === 1 || loading}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => fetchDevices(pageNum)}
                      disabled={loading}
                      className={`w-8 h-8 text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed ${currentPage === pageNum
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300'
                        }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => fetchDevices(currentPage + 1)}
                disabled={currentPage === totalPages || loading}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {edit && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/72 p-4 backdrop-blur-md">
          <div className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.32)] dark:border-white/10 dark:bg-[#0f172a]">
            {/* Modal Header */}
            <div className="relative overflow-hidden border-b border-slate-200 px-7 py-6 dark:border-white/10">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_42%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_36%)]" />
              <div className="relative flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-4">
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${getDeviceMeta(edit.deviceType).iconWrap}`}>
                    {(() => {
                      const Icon = getDeviceMeta(edit.deviceType).icon;
                      return <Icon className={`h-6 w-6 ${getDeviceMeta(edit.deviceType).iconColor}`} />;
                    })()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${DEVICE_TYPE_COLORS[edit.deviceType] ?? 'border border-slate-400/20 bg-slate-500/10 text-slate-500'}`}>
                        {DEVICE_TYPE_LABELS[edit.deviceType] ?? edit.deviceType}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${edit.networkStatus === 'ONLINE' ? 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400' : 'bg-slate-500/10 text-slate-500 dark:text-slate-400'}`}>
                        {edit.networkStatus === 'ONLINE' ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                        {edit.networkStatus}
                      </span>
                    </div>
                    <h2 className="mt-3 truncate text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                      {edit.deviceName}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Update the live configuration fields for this device.
                    </p>
                  </div>
                </div>
                <button
                  onClick={cancelEdit}
                  disabled={edit.saving}
                  className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="grid gap-6 px-7 py-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-5">
                <div className="space-y-4 rounded-2xl border border-slate-200 p-5 dark:border-white/10">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      IP Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={edit.ip_address}
                      onChange={(e) => setEdit((prev) => prev && { ...prev, ip_address: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 dark:border-white/15 dark:bg-slate-900 dark:text-white"
                      placeholder="e.g. 192.168.1.50"
                      disabled={edit.saving}
                    />
                  </div>

                  {COORD_EDIT_TYPES.has(edit.deviceType) && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                          Latitude <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={edit.latitude}
                          onChange={(e) => setEdit((prev) => prev && { ...prev, latitude: e.target.value })}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 dark:border-white/15 dark:bg-slate-900 dark:text-white"
                          placeholder="e.g. 19.0760"
                          disabled={edit.saving}
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                          Longitude <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={edit.longitude}
                          onChange={(e) => setEdit((prev) => prev && { ...prev, longitude: e.target.value })}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 dark:border-white/15 dark:bg-slate-900 dark:text-white"
                          placeholder="e.g. 72.8777"
                          disabled={edit.saving}
                        />
                      </div>
                    </div>
                  )}

                  {STATION_EDIT_TYPES.has(edit.deviceType) && (
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Station Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={edit.station_name}
                        onChange={(e) => setEdit((prev) => prev && { ...prev, station_name: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 dark:border-white/15 dark:bg-slate-900 dark:text-white"
                        placeholder="e.g. Mumbai Station"
                        disabled={edit.saving}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Device Details</h3>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 pb-3 text-sm dark:border-white/10">
                      <span className="text-slate-500 dark:text-slate-400">Device Type</span>
                      <span className="font-medium text-slate-800 dark:text-slate-100">{DEVICE_TYPE_LABELS[edit.deviceType] ?? edit.deviceType}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 pb-3 text-sm dark:border-white/10">
                      <span className="text-slate-500 dark:text-slate-400">Network</span>
                      <span className="font-medium text-slate-800 dark:text-slate-100">{edit.networkStatus}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 pb-3 text-sm dark:border-white/10">
                      <span className="text-slate-500 dark:text-slate-400">Station</span>
                      <span className="font-medium text-slate-800 dark:text-slate-100">{edit.station_name || '—'}</span>
                    </div>
                    <div className="flex items-start justify-between gap-4 text-sm">
                      <span className="text-slate-500 dark:text-slate-400">Editable Fields</span>
                      <span className="max-w-[180px] text-right font-medium text-slate-800 dark:text-slate-100">
                        {COORD_EDIT_TYPES.has(edit.deviceType) ? 'IP Address, Latitude, Longitude' : 'IP Address, Station Name'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                  <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Validation Rules</h3>
                  <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    <li>IP Address is required for all device types.</li>
                    <li>Latitude must be between -90 and 90.</li>
                    <li>Longitude must be between -180 and 180.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-7 py-5 dark:border-white/10">
              <button
                onClick={cancelEdit}
                disabled={edit.saving}
                className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={edit.saving}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
              >
                {edit.saving ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* add model */}

      {/* Add Device Modal */}
      {addDeviceState.open && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/72 p-4 backdrop-blur-md">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.32)] dark:border-white/10 dark:bg-[#0f172a] flex flex-col">
            {/* Header */}
            <div className="relative overflow-hidden border-b border-slate-200 px-7 py-6 dark:border-white/10 shrink-0">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_42%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_36%)]" />
              <div className="relative flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/12 border border-emerald-500/20">
                    <Plus className="h-6 w-6 text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
                      Add Device
                    </h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Register a new sensor device with location and network details.
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeAddDevice}
                  disabled={addDeviceState.submitting}
                  className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-7 py-6">
              {addDeviceState.loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <RefreshCw className="h-8 w-8 text-emerald-400 animate-spin" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">Loading device types…</p>
                </div>
              ) : (
                <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                  {(() => {
                    const isNodeDetailsRequired = NODE_REQUIRED_TYPES.has(addDeviceState.form.device_type);
                    const isAutoPopulatedType = MONITORING_DRONE_DF_TYPES.has(addDeviceState.form.device_type);
                    const isDeviceTypeSelected = Boolean(addDeviceState.form.device_type);
                    const isAddFieldDisabled = addDeviceState.submitting || !isDeviceTypeSelected;

                    return (
                      <>
                        <div className="space-y-5">
                          <div className="space-y-4 rounded-2xl border border-slate-200 p-5 dark:border-white/10">
                            {/* Device Type */}
                            <div>
                              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Device Type <span className="text-red-500">*</span>
                              </label>
                              <select
                                value={addDeviceState.form.device_type}
                                onChange={(e) => updateAddForm('device_type', e.target.value)}
                                disabled={addDeviceState.submitting}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 dark:border-white/15 dark:bg-slate-900 dark:text-white"
                              >
                                <option value="">Select device type</option>
                                {addDeviceState.deviceTypes.map((t) => (
                                  <option key={t} value={t}>
                                    {DEVICE_TYPE_LABELS[t] ?? t}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* IP + Port */}
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                  IP Address <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  value={addDeviceState.form.ip_address}
                                  onChange={(e) => updateAddForm('ip_address', e.target.value)}
                                  disabled={isAddFieldDisabled}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-white/15 dark:bg-slate-900 dark:text-white dark:disabled:bg-white/5"
                                  placeholder="e.g. 192.168.1.50"
                                />
                              </div>
                              <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                  Port <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="number"
                                  value={addDeviceState.form.port}
                                  onChange={(e) => updateAddForm('port', e.target.value)}
                                  disabled={isAddFieldDisabled}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-white/15 dark:bg-slate-900 dark:text-white dark:disabled:bg-white/5"
                                  placeholder="e.g. 8080"
                                />
                              </div>
                            </div>

                            {/* Lat / Lng */}
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                  Latitude <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="number"
                                  step="any"
                                  value={addDeviceState.form.latitude}
                                  onChange={(e) => updateAddForm('latitude', e.target.value)}
                                  disabled={isAddFieldDisabled}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-white/15 dark:bg-slate-900 dark:text-white dark:disabled:bg-white/5"
                                  placeholder="e.g. 19.0760"
                                />
                              </div>
                              <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                  Longitude <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="number"
                                  step="any"
                                  value={addDeviceState.form.longitude}
                                  onChange={(e) => updateAddForm('longitude', e.target.value)}
                                  disabled={isAddFieldDisabled}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-white/15 dark:bg-slate-900 dark:text-white dark:disabled:bg-white/5"
                                  placeholder="e.g. 72.8777"
                                />
                              </div>
                            </div>

                            {/* Optional: Node ID / Node Name */}
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                  Node ID {isNodeDetailsRequired && <span className="text-red-500">*</span>}
                                </label>
                                <input
                                  type="text"
                                  value={addDeviceState.form.node_id}
                                  onChange={(e) => updateAddForm('node_id', e.target.value)}
                                  disabled={isAddFieldDisabled || isAutoPopulatedType}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-white/15 dark:bg-slate-900 dark:text-white dark:disabled:bg-white/5"
                                  placeholder={!isDeviceTypeSelected || isAutoPopulatedType ? 'Auto populated' : 'e.g. NODE001'}
                                />
                              </div>
                              <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                  Node Name {isNodeDetailsRequired && <span className="text-red-500">*</span>}
                                </label>
                                <input
                                  type="text"
                                  value={addDeviceState.form.node_name}
                                  onChange={(e) => updateAddForm('node_name', e.target.value)}
                                  disabled={isAddFieldDisabled || isAutoPopulatedType}
                                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-white/15 dark:bg-slate-900 dark:text-white dark:disabled:bg-white/5"
                                  placeholder={!isDeviceTypeSelected || isAutoPopulatedType ? 'Auto populated' : 'e.g. Satellite Node 1'}
                                />
                              </div>
                            </div>

                            {/* Station name */}
                            <div>
                              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Station Name {isNodeDetailsRequired && <span className="text-red-500">*</span>}
                              </label>
                              <input
                                type="text"
                                value={addDeviceState.form.station_name}
                                onChange={(e) => updateAddForm('station_name', e.target.value)}
                                disabled={isAddFieldDisabled || isAutoPopulatedType}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-white/15 dark:bg-slate-900 dark:text-white dark:disabled:bg-white/5"
                                placeholder={!isDeviceTypeSelected || isAutoPopulatedType ? 'Auto populated' : 'e.g. Mumbai Station'}
                              />
                            </div>

                          </div>
                        </div>

                        {/* Right panel */}
                        <div className="space-y-4">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Required Fields</h3>
                            <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                              <li>Device Type</li>
                              <li>IP Address</li>
                              <li>Port (1–65535)</li>
                              <li>Latitude (−90 to 90)</li>
                              <li>Longitude (−180 to 180)</li>
                              {isNodeDetailsRequired && (
                                <>
                                  <li>Node ID</li>
                                  <li>Node Name</li>
                                  <li>Station Name</li>
                                </>
                              )}
                            </ul>
                          </div>

                          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                            <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Notes</h3>
                            <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                              <li>CSV running status starts at 0 for every new device.</li>
                              <li>Quard ID starts at 0 for every new device.</li>
                              <li>Node and station fields are auto populated later for Monitoring Sensor, Drone, and DF.</li>
                            </ul>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Footer */}
            {!addDeviceState.loading && (
              <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-7 py-5 dark:border-white/10 shrink-0">
                <button
                  onClick={closeAddDevice}
                  disabled={addDeviceState.submitting}
                  className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 disabled:opacity-50 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={submitAddDevice}
                  disabled={addDeviceState.submitting}
                  className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
                >
                  {addDeviceState.submitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Adding…
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Add Device
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Sensor"
        message="Delete this sensor?"
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        onConfirm={confirmDeleteSensor}
        onCancel={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
