'use client';

import { useState } from 'react';
import {
  WifiOff,
  Signal,
  Radio,
  Wifi,
  Wrench,
  Search,
  Filter,
  Download,
} from 'lucide-react';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { motion, AnimatePresence } from 'framer-motion';
import { useRef, useEffect } from 'react';
import { DataTable, Column } from '@/components/ui/data-table';
import { listEvents, type EventItem as ApiEventItem } from '@/api/events';

type EventSeverity = 'critical' | 'warning' | 'info' | 'success' | 'maintenance';

interface EventItem {
  id: string;
  title: string;
  severity: EventSeverity;
  nodeId: string;
  location: string;
  description: string;
  time: string;
  date: string;
}

const SEVERITY_CONFIG: Record<
  EventSeverity,
  { icon: React.ElementType; color: string; label: string }
> = {
  critical: { icon: WifiOff, color: '#ef4444', label: 'Critical' },
  warning: { icon: Signal, color: '#f59e0b', label: 'Warning' },
  info: { icon: Radio, color: '#f97316', label: 'Info' },
  success: { icon: Wifi, color: '#22c55e', label: 'Online' },
  maintenance: { icon: Wrench, color: '#0ea5e9', label: 'Maintenance' },
};

function mapSeverity(severity?: string): EventSeverity {
  if (severity === 'CRITICAL') return 'critical';
  if (severity === 'HIGH' || severity === 'MEDIUM') return 'warning';
  if (severity === 'LOW') return 'info';
  if (severity === 'INFORMATIONAL') return 'success';
  return 'maintenance';
}

function toUiEvent(event: ApiEventItem): EventItem {
  const date = event.timestamp || event.created_at || '';
  const parsedDate = date ? new Date(date) : null;

  return {
    id: String(event.event_id),
    title: event.event_type || `${event.severity || 'SYSTEM'} Event`,
    severity: mapSeverity(String(event.severity || '')),
    nodeId: event.node_id || event.subsystem_type || '-',
    location: event.subsystem_type || '-',
    description: event.message || event.event_type || 'Event received from backend.',
    time: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toLocaleTimeString() : '-',
    date: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString().slice(0, 10) : '',
  };
}

const eventColumns: Column<EventItem>[] = [
  {
    key: 'severity',
    header: 'Severity',
    width: '110px',
    render: (row) => {
      const config = SEVERITY_CONFIG[row.severity];
      const Icon = config.icon;
      return (
        <div
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase"
          style={{ color: config.color, background: `${config.color}15`, border: `1px solid ${config.color}30` }}
        >
          <Icon className="h-3 w-3" />
          {config.label}
        </div>
      );
    },
  },
  {
    key: 'title',
    header: 'Event',
    render: (row) => (
      <span className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-emerald-500 transition-colors">
        {row.title}
      </span>
    ),
  },
  {
    key: 'nodeId',
    header: 'Node ID',
    width: '120px',
    render: (row) => (
      <code className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">
        {row.nodeId}
      </code>
    ),
  },
  {
    key: 'location',
    header: 'Location',
    width: '160px',
    render: (row) => (
      <span className="text-xs text-slate-600 dark:text-slate-400">{row.location}</span>
    ),
  },
  {
    key: 'description',
    header: 'Description',
    render: (row) => (
      <p className="text-xs text-slate-500 dark:text-slate-500 truncate" title={row.description}>
        {row.description}
      </p>
    ),
  },
  {
    key: 'timestamp',
    header: 'Timestamp',
    width: '100px',
    render: (row) => (
      <div className="flex flex-col">
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{row.time}</span>
        <span className="text-[10px] text-slate-400">{row.date}</span>
      </div>
    ),
  },
];

function EventsFilter({
  dateFrom,
  dateTo,
  onApply,
  onClear,
}: {
  dateFrom: string;
  dateTo: string;
  onApply: (from: string, to: string) => void;
  onClear: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={filterRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-xs font-medium transition-all ${
          isOpen || dateFrom || dateTo
            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
            : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10'
        }`}
      >
        <Filter className="h-3.5 w-3.5" />
        {dateFrom || dateTo ? 'Filtered' : 'Filter'}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-50 p-4"
          >
            <DateRangePicker
              label="Filter by Date"
              dateFrom={dateFrom}
              dateTo={dateTo}
              onApply={(from, to) => {
                onApply(from, to);
                setIsOpen(false);
              }}
              onClear={() => {
                onClear();
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function EventsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadEvents = async () => {
      try {
        const data = await listEvents();
        if (mounted) {
          setEvents(data.map(toUiEvent));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadEvents();
    const interval = window.setInterval(loadEvents, 3000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const filteredEvents = events.filter((event) => {
    const matchesSearch =
      !searchQuery.trim() ||
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.nodeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDate = (!dateFrom || event.date >= dateFrom) && (!dateTo || event.date <= dateTo);
    return matchesSearch && matchesDate;
  });

  const handleExport = () => {
    const rows = filteredEvents.map((event) => ({
      id: event.id,
      title: event.title,
      severity: event.severity,
      node_id: event.nodeId,
      subsystem: event.location,
      description: event.description,
      date: event.date,
      time: event.time,
    }));
    const headers = Object.keys(rows[0] || {
      id: '',
      title: '',
      severity: '',
      node_id: '',
      subsystem: '',
      description: '',
      date: '',
      time: '',
    });
    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        headers
          .map((header) => `"${String(row[header as keyof typeof row] || '').replace(/"/g, '""')}"`)
          .join(','),
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `events-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Events & Alerts</h1>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search events, nodes, locations..."
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <EventsFilter
            dateFrom={dateFrom}
            dateTo={dateTo}
            onApply={(from, to) => {
              setDateFrom(from);
              setDateTo(to);
            }}
            onClear={() => {
              setDateFrom('');
              setDateTo('');
            }}
          />
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      <DataTable
        data={filteredEvents}
        columns={eventColumns}
        rowKey={(row) => row.id}
        pageSize={10}
        loading={loading}
      />
    </div>
  );
}
