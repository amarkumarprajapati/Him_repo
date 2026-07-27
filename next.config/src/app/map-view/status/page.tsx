"use client";

import { useEffect, useState } from "react";
import { Activity, Wifi, WifiOff } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/data-table";

interface TelemetryData {
  id: number;
  timestamp: string;
  created_at: string;
  telemetry_type: "cellular_passive" | "cellular_active" | "satellite";
  passive_cellular_id?: string;
  active_cellular_id?: string;
  satellite_id?: string;
  satellite_name?: string;
  protocol?: string;
  imsi?: string;
  imei?: string;
  operator_name?: string;
  signal_strength_dbm?: number;
  frequency_mhz?: number | null;
  bandwidth_mhz?: number;
  downlink_frequency_ghz?: number | null;
  uplink_frequency_ghz?: number | null;
  snr?: number | null;
  modulation?: string;
  latitude?: number;
  longitude?: number;
}

export default function TelemetryPage() {
  const [telemetryData, setTelemetryData] = useState<TelemetryData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    let abortController: AbortController | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelay = 3000;

    const connectToStream = async () => {
      abortController = new AbortController();

      try {
        const response = await fetch("/api/telemetry/stream", {
          headers: {
            Accept: "text/event-stream",
            "Cache-Control": "no-cache",
          },
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        setIsConnected(true);
        reconnectDelay = 3000;

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error("Response body is not readable");
        }

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            const trimmedLine = line.trim();

            if (trimmedLine === ": keepalive") {
              continue;
            }

            if (trimmedLine.startsWith("data: ")) {
              try {
                const jsonData = JSON.parse(trimmedLine.replace("data: ", ""));
                setTelemetryData((prev) => {
                  const newData = [jsonData, ...prev].slice(0, 100);
                  return newData;
                });
              } catch (error) {
                console.error("Error parsing telemetry data:", error);
              }
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          console.error("Stream error:", error);
          setIsConnected(false);

          reconnectDelay = Math.min(reconnectDelay * 2, 30000);
          reconnectTimer = setTimeout(() => {
            connectToStream();
          }, reconnectDelay);
        }
      }
    };

    connectToStream();

    return () => {
      if (abortController) {
        abortController.abort();
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
    };
  }, []);

  const columns: Column<TelemetryData>[] = [
    { key: "id", header: "ID", width: "60px" },
    {
      key: "telemetry_type",
      header: "Type",
      width: "140px",
      render: (data) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
            data.telemetry_type === "cellular_active"
              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
              : data.telemetry_type === "cellular_passive"
                ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
                : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
          }`}
        >
          {data.telemetry_type}
        </span>
      ),
    },
    {
      key: "deviceId",
      header: "Device ID",
      width: "140px",
      render: (data) =>
        (data.telemetry_type === "cellular_active" && data.active_cellular_id) ||
        (data.telemetry_type === "cellular_passive" && data.passive_cellular_id) ||
        (data.telemetry_type === "satellite" && data.satellite_id) ||
        "-",
    },
    {
      key: "operatorProtocol",
      header: "Operator/Protocol",
      width: "160px",
      render: (data) =>
        (data.telemetry_type === "cellular_active" && data.operator_name) ||
        (data.telemetry_type === "cellular_passive" && data.protocol) ||
        (data.telemetry_type === "satellite" && data.satellite_name) ||
        "-",
    },
    {
      key: "signal_strength_dbm",
      header: "Signal",
      width: "90px",
      render: (data) =>
        data.signal_strength_dbm !== undefined ? `${data.signal_strength_dbm} dBm` : "-",
    },
    {
      key: "frequency_mhz",
      header: "Frequency",
      width: "100px",
      render: (data) => (data.frequency_mhz ? `${data.frequency_mhz} MHz` : "-"),
    },
    {
      key: "location",
      header: "Location",
      width: "160px",
      render: (data) =>
        data.latitude !== undefined && data.longitude !== undefined
          ? `${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}`
          : "-",
    },
    {
      key: "timestamp",
      header: "Timestamp",
      width: "170px",
      render: (data) => new Date(data.timestamp).toLocaleString(),
    },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="mb-4 flex-shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          Status
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Real-time telemetry data from cellular and satellite sensors
        </p>
      </div>

      <DataTable
        data={telemetryData}
        columns={columns}
        pageSize={pageSize}
        rowKey={(data) => `${data.id}-${data.timestamp}`}
        title="TELEMETRY STREAM"
        titleIcon={<Activity className="h-4 w-4 text-[#4ade80]" />}
        className="flex-1 min-h-0"
        onPageSizeChange={setPageSize}
      />
    </div>
  );
}
