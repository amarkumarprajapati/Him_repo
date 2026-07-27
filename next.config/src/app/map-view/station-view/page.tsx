"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Globe, Maximize2, Minimize2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { listDeviceRegions, type DeviceItem } from "@/api/devices";
import { EmbeddedBrowser } from "@/components/ui/embedded-browser";
import { isPyQtDesktop } from "@/lib/pyqt-embed";

const QUARD_SLOTS = 6;
const ENABLE_TEST_URLS = true;

const TEST_SITES = [
  { id: "test:google", label: "TEST · Google", url: "https://google.com" },
  { id: "test:yahoo", label: "TEST · Yahoo", url: "https://yahoo.com" },
  { id: "test:bing", label: "TEST · Bing", url: "https://bing.com" },
  { id: "test:duckduckgo", label: "TEST · DuckDuckGo", url: "https://duckduckgo.com" },
  { id: "test:wikipedia", label: "TEST · Wikipedia", url: "https://wikipedia.org" },
  { id: "test:github", label: "TEST · GitHub", url: "https://github.com" },
] as const;

function getTestSite(id: string) {
  return TEST_SITES.find((site) => site.id === id);
}

function getDeviceUrl(device: DeviceItem) {
  if (Number(device.quard_id) === 0) {
    if (device.station_name === "cellular" && (device.device_type === "ACTIVE_CELL" || device.device_type === "PASSIVE_CELL")) {
      return "https://india-demo.nexyte.local/";
    }
    if (device.station_name === "SATELLITE" && device.device_type === "SATELLITE") {
      return "https://india-demo.nexyte.local/";
    }
  }
  return device.url || (device.port ? `http://${device.ip_address}:${device.port}` : device.ip_address);
}

function formatDeviceType(deviceType: string) {
  return deviceType.replace(/_/g, " ");
}

function getDeviceLabel(device: DeviceItem) {
  const type = formatDeviceType(device.device_type);
  const suffix = device.station_name || device.node_id || device.node_name;
  return suffix ? `${type} · ${suffix}` : type;
}

function StationPanel({
  quardId,
  devices,
  selectedDeviceId,
  onDeviceChange,
  onMaximize,
  isMaximized,
}: {
  quardId: number;
  devices: DeviceItem[];
  selectedDeviceId: string;
  onDeviceChange: (deviceId: string) => void;
  onMaximize?: () => void;
  isMaximized?: boolean;
}) {
  const testSites = (ENABLE_TEST_URLS && quardId !== 1 && quardId !== 2 && quardId !== 3 && quardId !== 4 && quardId !== 5 && quardId !== 6) ? TEST_SITES : [];
  const hasOptions = devices.length > 0 || testSites.length > 0;

  const selectedDevice =
    devices.find((d) => d.device_id === selectedDeviceId) ?? devices[0] ?? null;
  const selectedTest = getTestSite(selectedDeviceId);
  const url = selectedTest
    ? selectedTest.url
    : selectedDevice
      ? getDeviceUrl(selectedDevice)
      : testSites[0]?.url ?? "";
  const isOnline = selectedDevice?.network_status === "ONLINE";
  const activeSelectionId =
    selectedDeviceId ||
    selectedDevice?.device_id ||
    testSites[0]?.id ||
    "";

  if (!hasOptions) {
    return (
      <div className="flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 dark:border-white/10 dark:bg-[#0f172a]/40">
        <div className="flex shrink-0 items-center border-b border-slate-200 bg-slate-100 px-3 py-2 dark:border-white/10 dark:bg-[#1e293b]">
          <span className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400">
            STATION {quardId}
          </span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center text-slate-400">
          <Globe className="mb-2 h-6 w-6 opacity-40" />
          <span className="text-xs">No devices assigned</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#0f172a]">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-200 bg-slate-100 px-3 py-2 dark:border-white/10 dark:bg-[#1e293b]">
        <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
          Station {quardId}
        </span>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Sensor
          </span>
          <select
            value={activeSelectionId}
            onChange={(e) => onDeviceChange(e.target.value)}
            className="min-w-0 flex-1 cursor-pointer rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-800 outline-none focus:ring-1 focus:ring-emerald-500/50 dark:border-white/10 dark:bg-[#0f172a] dark:text-slate-100"
          >
            {devices.map((device) => (
              <option key={device.device_id} value={device.device_id}>
                {getDeviceLabel(device)}
              </option>
            ))}
            {testSites.length > 0 && (
              <optgroup label="Test URLs">
                {testSites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.label}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {url && onMaximize && (
          <button
            type="button"
            title={isMaximized ? "Restore grid view" : "Maximize station"}
            onClick={onMaximize}
            className="ml-auto shrink-0 cursor-pointer rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-200 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-blue-300"
          >
            {isMaximized ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>

      <div
        className="shrink-0 truncate border-b border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-mono text-slate-500 dark:border-white/10 dark:bg-[#0b1426] dark:text-slate-400"
        title={url}
      >
        {url}
      </div>

      <div className="relative min-h-0 flex-1 bg-[#020617]">
        {url ? (
          <EmbeddedBrowser
            embedId={`station-${quardId}`}
            url={url}
            title={`Station ${quardId} – ${selectedTest?.label ?? (selectedDevice ? getDeviceLabel(selectedDevice) : "Browser")}`}
            className="h-full w-full border-0"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">
            No URL available
          </div>
        )}
      </div>
    </div>
  );
}

export default function StationViewPage() {
  const router = useRouter();
  const [regions, setRegions] = useState<DeviceItem[][]>(Array(QUARD_SLOTS).fill([]));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDevices, setSelectedDevices] = useState<Record<number, string>>({});
  const [maximizedQuard, setMaximizedQuard] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRegions() {
      setLoading(true);
      setError(null);
      try {
        const res = await listDeviceRegions();
        if (cancelled) return;

        const slots: DeviceItem[][] = Array.from({ length: QUARD_SLOTS }, () => []);

        // Collect all devices from all regions
        const allDevices: DeviceItem[] = [];
        for (const region of res.results) {
          allDevices.push(...region.devices);
        }

        // Map devices to slots by station_name
        for (const device of allDevices) {
          const name = device.station_name?.toLowerCase();
          if (name === "mumbai") {
            slots[0].push(device);
          } else if (name === "pune station") {
            slots[1].push(device);
          } else if (name === "delhi station") {
            slots[2].push(device);
          } else if (name === "bangalore station") {
            slots[3].push(device);
          } else if (name === "cellular") {
            slots[4].push(device);
          } else if (name === "satellite") {
            slots[5].push(device);
          }
        }

        // Sort each slot's devices by device_type
        for (let i = 0; i < QUARD_SLOTS; i++) {
          slots[i].sort((a, b) => a.device_type.localeCompare(b.device_type));
        }

        setRegions(slots);

        const defaults: Record<number, string> = {};
        slots.forEach((devices, index) => {
          if (devices.length > 0) {
            defaults[index + 1] = devices[0].device_id;
          }
        });
        setSelectedDevices(defaults);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load regions");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadRegions();
    return () => {
      cancelled = true;
    };
  }, []);

  const quardSlots = useMemo(
    () => Array.from({ length: QUARD_SLOTS }, (_, i) => i + 1),
    [],
  );
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    setReduceMotion(isPyQtDesktop());
  }, []);

  // Maximized view: fill the entire content area, no header or padding
  if (maximizedQuard !== null) {
    const quardId = maximizedQuard;
    return (
      <motion.div
        key="maximized"
        initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.25, ease: "easeOut" }}
        className="-m-4 lg:-m-6 flex h-[calc(100vh-60px)] w-[calc(100%+2rem)] lg:w-[calc(100%+3rem)] min-w-0 overflow-hidden"
      >
        {loading ? (
          <div className="h-full w-full animate-pulse border border-slate-200 bg-white dark:border-white/10 dark:bg-[#0f172a]" />
        ) : (
          <StationPanel
            quardId={quardId}
            devices={regions[quardId - 1] ?? []}
            selectedDeviceId={selectedDevices[quardId] ?? ""}
            onDeviceChange={(deviceId) => {
              setSelectedDevices((prev) => ({ ...prev, [quardId]: deviceId }));
            }}
            onMaximize={() => setMaximizedQuard(null)}
            isMaximized={true}
          />
        )}
      </motion.div>
    );
  }

  // Normal 6-panel grid view
  return (
    <motion.div
      key="grid"
      initial={reduceMotion ? false : { opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.4, ease: "easeOut" }}
      className="-m-4 lg:-m-6 flex h-[calc(100vh-60px)] w-full min-w-0 flex-col overflow-hidden p-4 lg:p-6"
    >
      <div className="mb-4 flex shrink-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Station View
          </h1>
        </div>
        <button
          onClick={() => router.push("/map-view")}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Map View
        </button>
      </div>

      {error && (
        <div className="mb-4 shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-600 dark:text-red-300">
          {error}
        </div>
      )}

      <div
        className="grid min-h-0 w-full min-w-0 flex-1 gap-4 overflow-hidden p-1"
        style={{
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gridTemplateRows: "repeat(2, minmax(0, 1fr))",
        }}
      >
        {loading
          ? quardSlots.map((quardId) => (
            <div
              key={quardId}
              className="min-h-0 min-w-0 animate-pulse rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#0f172a]"
            />
          ))
          : quardSlots.map((quardId) => (
            <StationPanel
              key={quardId}
              quardId={quardId}
              devices={regions[quardId - 1] ?? []}
              selectedDeviceId={selectedDevices[quardId] ?? ""}
              onDeviceChange={(deviceId) => {
                setSelectedDevices((prev) => ({ ...prev, [quardId]: deviceId }));
              }}
              onMaximize={() => setMaximizedQuard(quardId)}
              isMaximized={false}
            />
          ))}
      </div>
    </motion.div>
  );
}
