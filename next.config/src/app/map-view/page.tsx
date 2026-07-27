"use client";

import dynamic from "next/dynamic";

const TelemetryMap = dynamic(
  () => import("@/components/map-view/telemetry-map"),
  { ssr: false },
);
const EventsPanel = dynamic(
  () =>
    import("@/components/map-view/events-panel").then((mod) => ({
      default: mod.EventsPanel,
    })),
  { ssr: false },
);

export default function MapViewPage() {
  return (
    <div className="-m-4 lg:-m-6 h-[calc(100vh-60px)] relative flex overflow-hidden">
      <div className="flex-1 min-w-0">
        <TelemetryMap />
      </div>
      <EventsPanel />
    </div>
  );
}
