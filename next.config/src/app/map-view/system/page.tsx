'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  Power,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { getSystemHealth, type SystemHealthResponse } from '@/api/system';

function formatBytes(bytes: number): string {
  const gb = bytes / 1024 / 1024 / 1024;
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(2)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(2)} KB`;
}

function formatDate(ts: string | number): string {
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
  return d.toLocaleString();
}

function percentColor(percent: number): string {
  if (percent >= 90) return 'text-red-500';
  if (percent >= 70) return 'text-amber-500';
  return 'text-[#4ade80]';
}

function percentBarColor(percent: number): string {
  if (percent >= 90) return 'bg-red-500';
  if (percent >= 70) return 'bg-amber-500';
  return 'bg-[#4ade80]';
}

export default function SystemPage() {
  const [data, setData] = useState<SystemHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      setLoading((prev) => !data && prev);
      setError(null);
      const res = await getSystemHealth();
      setData(res);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch system health');
    } finally {
      setLoading(false);
    }
  }, [data]);

  useEffect(() => {
    fetchHealth();
    const interval = window.setInterval(fetchHealth, 10000);
    return () => window.clearInterval(interval);
  }, [fetchHealth]);

  const summary = data
    ? [
        {
          label: 'CPU Usage',
          value: `${data.cpu.percent.toFixed(1)}%`,
          sub: `${data.cpu.count} cores @ ${data.cpu.frequency_mhz} MHz`,
          icon: Cpu,
          color: percentColor(data.cpu.percent),
          bg: 'bg-[#4ade80]/10',
          border: 'border-[#4ade80]/20',
        },
        {
          label: 'Memory Usage',
          value: `${data.memory.percent.toFixed(1)}%`,
          sub: `${(data.memory.used_mb / 1024).toFixed(2)} / ${(data.memory.total_mb / 1024).toFixed(2)} GB`,
          icon: MemoryStick,
          color: percentColor(data.memory.percent),
          bg: 'bg-[#38bdf8]/10',
          border: 'border-[#38bdf8]/20',
        },
        {
          label: 'Disk Usage',
          value: `${data.disk.percent.toFixed(1)}%`,
          sub: `${data.disk.used_gb.toFixed(2)} / ${data.disk.total_gb.toFixed(2)} GB`,
          icon: HardDrive,
          color: percentColor(data.disk.percent),
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/20',
        },
        {
          label: 'Network IO',
          value: formatBytes(data.network.bytes_recv + data.network.bytes_sent),
          sub: `${data.network.interfaces.length} interface${data.network.interfaces.length === 1 ? '' : 's'}`,
          icon: Network,
          color: 'text-[#4ade80]',
          bg: 'bg-purple-500/10',
          border: 'border-purple-500/20',
        },
      ]
    : [];

  return (
    <div className="w-full pb-10">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">System Health</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Real-time system metrics and resource utilization
          </p>
        </div>
        <div className="flex items-center gap-3">
        </div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </motion.div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading && !data
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-white/5 p-4 h-[120px] animate-pulse"
              >
                <div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded mb-4" />
                <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded mb-2" />
                <div className="h-3 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
              </div>
            ))
          : summary.length === 0 && !loading ? (
              <div className="col-span-full bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-white/5 p-12 text-center">
                <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                  <Cpu className="h-8 w-8 text-slate-400 dark:text-slate-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No System Data</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Unable to fetch system health information.</p>
              </div>
            ) : (
              summary.map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-white/5 p-4 flex flex-col justify-between h-[120px]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                    {item.label.toUpperCase()}
                  </span>
                  <div className={`p-1.5 rounded-md ${item.bg} border ${item.border}`}>
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                  </div>
                </div>
                <div>
                  <span className={`text-3xl font-light ${item.color}`}>{item.value}</span>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{item.sub}</p>
                </div>
              </motion.div>
            ))
            )}
      </div>

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-white/5 p-5"
          >
            <div className="flex items-center gap-2 mb-5">
              <Cpu className="h-4 w-4 text-[#4ade80]" />
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tracking-wider">CPU</span>
            </div>
            <div className="space-y-4">
              <MetricRow label="Usage" value={`${data.cpu.percent.toFixed(1)}%`}>
                <ProgressBar percent={data.cpu.percent} />
              </MetricRow>
              <MetricRow label="Cores" value={`${data.cpu.count}`} />
              <MetricRow label="Frequency" value={`${data.cpu.frequency_mhz} MHz`} />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-white/5 p-5"
          >
            <div className="flex items-center gap-2 mb-5">
              <MemoryStick className="h-4 w-4 text-[#38bdf8]" />
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tracking-wider">MEMORY</span>
            </div>
            <div className="space-y-4">
              <MetricRow label="Usage" value={`${data.memory.percent.toFixed(1)}%`}>
                <ProgressBar percent={data.memory.percent} />
              </MetricRow>
              <MetricRow label="Total" value={`${(data.memory.total_mb / 1024).toFixed(2)} GB`} />
              <MetricRow label="Used" value={`${(data.memory.used_mb / 1024).toFixed(2)} GB`} />
              <MetricRow label="Available" value={`${(data.memory.available_mb / 1024).toFixed(2)} GB`} />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-white/5 p-5"
          >
            <div className="flex items-center gap-2 mb-5">
              <HardDrive className="h-4 w-4 text-amber-500" />
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tracking-wider">DISK</span>
            </div>
            <div className="space-y-4">
              <MetricRow label="Usage" value={`${data.disk.percent.toFixed(1)}%`}>
                <ProgressBar percent={data.disk.percent} />
              </MetricRow>
              <MetricRow label="Total" value={`${data.disk.total_gb.toFixed(2)} GB`} />
              <MetricRow label="Used" value={`${data.disk.used_gb.toFixed(2)} GB`} />
              <MetricRow label="Free" value={`${data.disk.free_gb.toFixed(2)} GB`} />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-white/5 p-5"
          >
            <div className="flex items-center gap-2 mb-5">
              <Power className="h-4 w-4 text-purple-500" />
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tracking-wider">SYSTEM</span>
            </div>
            <div className="space-y-4">
              {data.timestamp && (
                <MetricRow label="Timestamp" value={formatDate(data.timestamp)} />
              )}
              <MetricRow label="Boot Time" value={formatDate(data.boot_time)} />
              <MetricRow label="Swap Used" value={`${data.swap.percent.toFixed(1)}%`}>
                <ProgressBar percent={data.swap.percent} />
              </MetricRow>
              <MetricRow label="Swap Total" value={`${data.swap.total_mb.toFixed(0)} MB`} />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-2 bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-white/5 p-5"
          >
            <div className="flex items-center gap-2 mb-5">
              <Network className="h-4 w-4 text-[#4ade80]" />
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tracking-wider">NETWORK</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
              <MiniStat label="Bytes Sent" value={formatBytes(data.network.bytes_sent)} />
              <MiniStat label="Bytes Received" value={formatBytes(data.network.bytes_recv)} />
              <MiniStat label="Packets Sent" value={data.network.packets_sent.toLocaleString()} />
              <MiniStat label="Packets Received" value={data.network.packets_recv.toLocaleString()} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tracking-wider mb-2">INTERFACES</p>
              <div className="flex flex-wrap gap-2">
                {data.network.interfaces.map((iface) => (
                  <span
                    key={iface}
                    className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-xs font-mono text-slate-700 dark:text-slate-300"
                  >
                    {iface}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function MetricRow({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
        <span className="text-xs font-mono font-medium text-slate-900 dark:text-white">{value}</span>
      </div>
      {children}
    </div>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-1.5 w-full bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${percentBarColor(percent)} transition-all duration-500`}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-100 dark:border-white/5 p-3">
      <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-1 tracking-wider">{label.toUpperCase()}</p>
      <p className="text-sm font-mono font-medium text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
