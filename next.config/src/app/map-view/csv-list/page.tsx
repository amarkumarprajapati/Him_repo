"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ChevronDown,
  ChevronRight,
  FileText,
  HardDrive,
  FolderOpen,
  Radio,
  RefreshCw,
} from "lucide-react";
import {
  listTelemetryFiles,
  type TelemetryStation,
  type TelemetryDeviceType,
  type TelemetryFile,
} from "@/api/telemetry";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString();
  } catch {
    return dateStr;
  }
}

function StationCard({
  station,
  searchQuery,
}: {
  station: TelemetryStation;
  searchQuery: string;
}) {
  const [isOpen, setIsOpen] = useState(true);

  const filteredDeviceTypes = station.device_types
    .map((dt) => {
      const filteredFiles = dt.files.filter((f) =>
        f.filename.toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (searchQuery && filteredFiles.length === 0) return null;
      return { ...dt, files: searchQuery ? filteredFiles : dt.files };
    })
    .filter(Boolean) as TelemetryDeviceType[];

  if (searchQuery && filteredDeviceTypes.length === 0) return null;

  return (
    <div className="bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <Radio className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {station.station_name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {filteredDeviceTypes.length} device type
              {filteredDeviceTypes.length !== 1 ? "s" : ""} ·{" "}
              {filteredDeviceTypes.reduce((sum, dt) => sum + dt.files.length, 0)} files
            </p>
          </div>
        </div>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-slate-400" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-200 dark:border-white/10 px-5 py-4 space-y-4">
              {filteredDeviceTypes.map((dt) => (
                <DeviceTypeSection
                  key={dt.device_type}
                  deviceType={dt}
                  searchQuery={searchQuery}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DeviceTypeSection({
  deviceType,
  searchQuery,
}: {
  deviceType: TelemetryDeviceType;
  searchQuery: string;
}) {
  const [isOpen, setIsOpen] = useState(true);

  const filteredFiles = deviceType.files.filter((f) =>
    f.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (searchQuery && filteredFiles.length === 0) return null;

  const filesToShow = searchQuery ? filteredFiles : deviceType.files;

  return (
    <div className="rounded-lg border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/[0.03]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            {deviceType.device_type}
          </span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-white/10 px-1.5 py-0.5 rounded">
            {filesToShow.length}
          </span>
        </div>
        {isOpen ? (
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-1">
              {filesToShow.map((file, idx) => (
                <FileRow key={`${file.filename}-${idx}`} file={file} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FileRow({ file }: { file: TelemetryFile }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-md bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/5 hover:border-emerald-500/30 dark:hover:border-emerald-500/30 transition-colors group">
      <div className="flex items-center gap-3 min-w-0">
        <FileText className="h-4 w-4 text-slate-400 shrink-0" />
        <div className="min-w-0">
          <p
            className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate"
            title={file.filename}
          >
            {file.filename}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-500">
            {formatDate(file.modified_at)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
          {formatBytes(file.size)}
        </span>
      </div>
    </div>
  );
}

export default function CSVListPage() {
  const [data, setData] = useState<TelemetryStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = async () => {
    try {
      setError(null);
      const res = await listTelemetryFiles();
      setData(res.stations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch files");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalFiles = data.reduce((sum, s) => sum + s.total_files, 0);
  const totalStations = data.length;

  const filteredStations = data
    .map((s) => {
      const matchingDeviceTypes = s.device_types
        .map((dt) => {
          const matchingFiles = dt.files.filter((f) =>
            f.filename.toLowerCase().includes(searchQuery.toLowerCase())
          );
          if (searchQuery && matchingFiles.length === 0) return null;
          return { ...dt, files: searchQuery ? matchingFiles : dt.files };
        })
        .filter(Boolean) as TelemetryDeviceType[];

      if (searchQuery && matchingDeviceTypes.length === 0) return null;
      return { ...s, device_types: matchingDeviceTypes };
    })
    .filter(Boolean) as TelemetryStation[];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full pb-10"
    >
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            CSV List
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Telemetry files grouped by station and device type
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-white/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Radio className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Stations
            </span>
          </div>
          <p className="text-2xl font-light text-slate-900 dark:text-white">
            {totalStations}
          </p>
        </div>
        <div className="bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-white/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <HardDrive className="h-3.5 w-3.5 text-[#38bdf8]" />
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Files
            </span>
          </div>
          <p className="text-2xl font-light text-slate-900 dark:text-white">
            {totalFiles}
          </p>
        </div>
        <div className="col-span-2 sm:col-span-1 bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-white/10 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all"
            />
          </div>
        </div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400"
        >
          {error}
        </motion.div>
      )}

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-white/10 p-5 animate-pulse"
            >
              <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded mb-2" />
              <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
          ))
        ) : filteredStations.length === 0 ? (
          <div className="bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-white/10 p-12 text-center">
            <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center">
              <FileText className="h-8 w-8 text-slate-400 dark:text-slate-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              No Files Found
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {searchQuery
                ? "No files match your search."
                : "No telemetry files available."}
            </p>
          </div>
        ) : (
          filteredStations.map((station) => (
            <StationCard
              key={station.station_name}
              station={station}
              searchQuery={searchQuery}
            />
          ))
        )}
      </div>
    </motion.div>
  );
}

