'use client';

import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/store/hooks';
import { MapPin, Pencil, X, Check, RefreshCw, Upload, Wifi, WifiOff } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  listSensorLocations,
  uploadSensorLocations,
  updateSensorLocation,
  type DeviceItem,
} from '@/api/devices';
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

interface EditState {
  deviceId: string;
  latitude: string;
  longitude: string;
  saving: boolean;
}

export default function SensorManagementPage() {
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);

  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Guard: Admin only
  useEffect(() => {
    if (user && user.role !== 'SUPER_ADMIN') {
      router.replace('/map-view');
    }
  }, [user, router]);

  const fetchDevices = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listSensorLocations();
      setDevices(res.data ?? []);
    } catch {
      setError('Failed to load sensor devices.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const startEdit = (device: DeviceItem) => {
    setEdit({
      deviceId: device.device_id,
      latitude: device.latitude != null ? String(device.latitude) : '',
      longitude: device.longitude != null ? String(device.longitude) : '',
      saving: false,
    });
  };

  const cancelEdit = () => setEdit(null);

  const saveEdit = async () => {
    if (!edit) return;
    const lat = parseFloat(edit.latitude);
    const lng = parseFloat(edit.longitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      showToast.error('Latitude must be a number between -90 and 90.');
      return;
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      showToast.error('Longitude must be a number between -180 and 180.');
      return;
    }
    setEdit((prev) => prev && { ...prev, saving: true });
    try {
      await updateSensorLocation(edit.deviceId, { latitude: lat, longitude: lng });
      showToast.success('Sensor location updated.');
      setEdit(null);
      await fetchDevices();
    } catch {
      showToast.error('Failed to update sensor location.');
      setEdit((prev) => prev && { ...prev, saving: false });
    }
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploading(true);
    try {
      const response = await uploadSensorLocations(file);
      const { updated_count, failed_count, errors } = response.data;

      if (failed_count > 0) {
        const firstError = errors[0]?.message ?? 'Some rows could not be processed.';
        showToast.error(`Updated ${updated_count} row(s). ${failed_count} failed. ${firstError}`);
      } else {
        showToast.success(`Updated ${updated_count} sensor location row(s).`);
      }

      await fetchDevices();
    } catch {
      showToast.error('Failed to upload sensor location file.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  if (user?.role !== 'SUPER_ADMIN') return null;

  return (
    <div className="p-6 space-y-6 min-h-screen bg-slate-50 dark:bg-[#0f172a]">
      {/* Header */}
      <div className="flex items-center justify-between">
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
          onClick={fetchDevices}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

     

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-200 dark:bg-white/5 animate-pulse" />
          ))}
        </div>
      )}

      {/* Device table */}
      {!loading && devices.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
          <MapPin className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm">No sensor devices found.</p>
        </div>
      )}

      {!loading && devices.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/8 bg-white dark:bg-[#1e293b]/60 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/8 bg-slate-50 dark:bg-white/3">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Device
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Latitude
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Longitude
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              <AnimatePresence initial={false}>
                {devices.map((device) => {
                  const isEditing = edit?.deviceId === device.device_id;
                  const typeLabel = DEVICE_TYPE_LABELS[device.device_type] ?? device.device_type;
                  const typeColor = DEVICE_TYPE_COLORS[device.device_type] ?? 'bg-slate-500/15 text-slate-400';
                  const isOnline = device.network_status === 'ONLINE';

                  return (
                    <motion.tr
                      key={device.device_id}
                      layout
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className={`transition-colors ${isEditing ? 'bg-emerald-500/5 dark:bg-emerald-500/8' : 'hover:bg-slate-50 dark:hover:bg-white/3'}`}
                    >
                      {/* Device name */}
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {device.node_name ?? device.station_name ?? '—'}
                        </div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">
                          {device.ip_address ?? String(device.device_id).slice(0, 8) + '…'}
                        </div>
                      </td>

                      {/* Type badge */}
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${typeColor}`}>
                          {typeLabel}
                        </span>
                      </td>

                      {/* Network status */}
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${isOnline ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                          {isOnline ? 'Online' : 'Offline'}
                        </span>
                      </td>

                      {/* Latitude */}
                      <td className="px-5 py-3.5">
                        {isEditing ? (
                          <input
                            type="number"
                            step="any"
                            value={edit.latitude}
                            onChange={(e) => setEdit((prev) => prev && { ...prev, latitude: e.target.value })}
                            className="w-32 px-2 py-1.5 rounded-lg text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                            placeholder="e.g. 19.0760"
                          />
                        ) : (
                          <span className="font-mono text-slate-700 dark:text-slate-300">
                            {device.latitude != null ? device.latitude.toFixed(6) : '—'}
                          </span>
                        )}
                      </td>

                      {/* Longitude */}
                      <td className="px-5 py-3.5">
                        {isEditing ? (
                          <input
                            type="number"
                            step="any"
                            value={edit.longitude}
                            onChange={(e) => setEdit((prev) => prev && { ...prev, longitude: e.target.value })}
                            className="w-32 px-2 py-1.5 rounded-lg text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-white/15 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                            placeholder="e.g. 72.8777"
                          />
                        ) : (
                          <span className="font-mono text-slate-700 dark:text-slate-300">
                            {device.longitude != null ? device.longitude.toFixed(6) : '—'}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={saveEdit}
                              disabled={edit.saving}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500 hover:bg-emerald-600 text-white transition-colors disabled:opacity-50"
                            >
                              <Check className="h-3.5 w-3.5" />
                              {edit.saving ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              onClick={cancelEdit}
                              disabled={edit.saving}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-200 dark:bg-white/8 hover:bg-slate-300 dark:hover:bg-white/15 text-slate-700 dark:text-slate-300 transition-colors disabled:opacity-50"
                            >
                              <X className="h-3.5 w-3.5" />
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(device)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </button>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
