"use client";

import { useState, useRef, useEffect } from "react";
import {
  List,
  Satellite,
  Drone,
  Antenna,
  RadioTower,
  Orbit,
  X,
} from "lucide-react";
import Link from "next/link";
import { useUi } from "@/components/layout/ui-context";
import { listEvents, type EventItem as ApiEventItem } from "@/api/events";

type DeviceType = "rf" | "drone" | "active_cellular" | "passive_cellular" | "satellite";

interface EventItem {
  id: string;
  title: string;
  subtitle: string;
  deviceType: DeviceType;
  code: string;
  time: string;
}

const DEVICE_CONFIG: Record<
  DeviceType,
  { icon: typeof Satellite; color: string }
> = {
  rf: { icon: Satellite, color: "#38bdf8" },
  drone: { icon: Drone, color: "#f59e0b" },
  active_cellular: { icon: Antenna, color: "#22c55e" },
  passive_cellular: { icon: RadioTower, color: "#ef4444" },
  satellite: { icon: Orbit, color: "#a855f7" },
};

function deviceTypeFromEvent(event: ApiEventItem): DeviceType {
  const source = `${event.subsystem_type || ""} ${event.event_type || ""} ${event.message || ""}`.toUpperCase();
  if (source.includes("DRONE")) return "drone";
  if (source.includes("SATELLITE") || source.includes("SAT")) return "satellite";
  if (source.includes("ACTIVE")) return "active_cellular";
  if (source.includes("PASSIVE")) return "passive_cellular";
  return "rf";
}

function toPanelEvent(event: ApiEventItem, index: number): EventItem {
  const deviceType = deviceTypeFromEvent(event);
  const timestamp = event.timestamp || event.created_at || "";
  const parsedDate = timestamp ? new Date(timestamp) : null;
  const time =
    parsedDate && !Number.isNaN(parsedDate.getTime())
      ? `${parsedDate.toLocaleTimeString()} IST`
      : "-";
  const rawId = event.event_id ?? (event as { id?: string | number }).id;
  const id =
    rawId !== undefined && rawId !== null
      ? String(rawId)
      : `event-${index}-${timestamp || "unknown"}`;

  return {
    id,
    title: event.event_type || `${event.severity || "SYSTEM"} Event`,
    subtitle: event.subsystem_type || event.message || "-",
    deviceType,
    code: event.node_id || event.session_id || id,
    time,
  };
}

export function EventsPanel() {
  const { isEventsOpen, setEventsOpen } = useUi();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilters] = useState<Set<DeviceType>>(
    new Set(["rf", "drone", "active_cellular", "passive_cellular", "satellite"]),
  );
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isEventsOpen) return;

    let mounted = true;

    const loadEvents = async () => {
      try {
        const data = await listEvents();
        if (mounted) {
          setEvents(data.map((event, index) => toPanelEvent(event, index)));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    setLoading(true);
    loadEvents();
    const interval = window.setInterval(loadEvents, 10000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [isEventsOpen]);

  const filteredEvents = events.filter((e) => activeFilters.has(e.deviceType));

  return (
    <div
      className={`panel-slide absolute top-0 right-0 z-[6000] flex h-full w-[360px] flex-col overflow-hidden border-l border-slate-200 bg-white backdrop-blur-xl dark:border-white/5 dark:bg-[#0f172a]/95 ${
        isEventsOpen
          ? "translate-x-0 opacity-100"
          : "translate-x-full opacity-0 pointer-events-none"
      }`}
    >
      <div className="flex h-[56px] shrink-0 items-center justify-between border-b border-slate-100 px-4 dark:border-white/5">
        <span className="text-[13px] font-bold uppercase tracking-wide text-slate-900 dark:text-white">
          Events
        </span>
        <div ref={filterRef} className="relative flex items-center gap-1">
          <button
            onClick={() => setEventsOpen(false)}
            className="cursor-pointer rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-white"
            title="Close events"
            aria-label="Close events"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto">
        <div className="divide-y divide-slate-100 dark:divide-white/5">
          {loading && filteredEvents.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <p className="text-sm">Loading events...</p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <List className="mx-auto mb-3 h-12 w-12 text-slate-300 dark:text-slate-700" />
              <p className="text-sm">No events to display</p>
            </div>
          ) : (
            filteredEvents.map((event) => {
              const config = DEVICE_CONFIG[event.deviceType];
              const Icon = config.icon;

              return (
                <div
                  key={event.id}
                  className="group flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.dispatchEvent(
                        new CustomEvent("focus-node", {
                          detail: { nodeId: event.code },
                        }),
                      );
                    }
                  }}
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
                    style={{
                      borderColor: `${config.color}50`,
                      backgroundColor: `${config.color}15`,
                      boxShadow: `0 0 12px ${config.color}20`,
                    }}
                  >
                    <Icon
                      className="h-5 w-5"
                      style={{ color: config.color }}
                      strokeWidth={1.5}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold leading-tight text-slate-800 dark:text-slate-200">
                      {event.title}
                    </div>
                    <div className="mt-0.5 text-[11px] leading-tight text-slate-500">
                      {event.subtitle}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="text-[13px] font-medium text-slate-700 dark:text-slate-300">
                      {event.code}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                      {event.time}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-100 p-3 dark:border-white/5">
        <Link
          href="/map-view/events"
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-slate-500 transition-all duration-200 hover:bg-slate-100 hover:text-slate-900 dark:border-white/5 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
        >
          <List className="h-4 w-4" strokeWidth={1.5} />
          View All Events
        </Link>
      </div>
    </div>
  );
}
