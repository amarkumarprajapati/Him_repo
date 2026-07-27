"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import {
  Bell,
  AlertTriangle,
  Info,
  AlertCircle,
  Clock,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchNotifications,
} from "@/store/slices/notificationSlice";
import type { NotificationItem } from "@/api/notifications";
import { DataTable, type Column } from "@/components/ui/data-table";

const PRIORITY_ICON: Record<string, ReactNode> = {
  CRITICAL: <AlertCircle className="h-4 w-4 text-red-500" />,
  HIGH: <AlertTriangle className="h-4 w-4 text-orange-500" />,
  MEDIUM: <Info className="h-4 w-4 text-sky-500" />,
  LOW: <Bell className="h-4 w-4 text-emerald-500" />,
};

export default function NotificationsPage() {
  const dispatch = useAppDispatch();
  const { notifications, loading } = useAppSelector(
    (state) => state.notifications,
  );

  useEffect(() => {
    dispatch(fetchNotifications());
  }, [dispatch]);

  const columns: Column<NotificationItem>[] = useMemo(
    () => [
      {
        key: "status",
        header: "Status",
        render: (row) => (
          <div className="flex items-center justify-center">
            <div
              className={`h-2 w-2 rounded-full ${row.status === "UNREAD" ? "bg-sky-500 animate-pulse ring-4 ring-sky-500/20" : "bg-slate-300 dark:bg-white/10"}`}
            />
          </div>
        ),
        width: "60px",
      },
      {
        key: "priority",
        header: "Priority",
        render: (row) => (
          <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.05] w-fit">
            {PRIORITY_ICON[row.priority] || (
              <Bell className="h-4 w-4 text-slate-400" />
            )}
            <span className="text-[10px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
              {row.priority}
            </span>
          </div>
        ),
        width: "140px",
      },
      {
        key: "title",
        header: "Message",
        render: (row) => (
          <div className="flex flex-col gap-1 py-2">
            <span
              className={`text-[13px] font-bold ${row.status === "UNREAD" ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400"}`}
            >
              {row.title}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-500 leading-relaxed max-w-2xl">
              {row.message}
            </span>
          </div>
        ),
      },
      {
        key: "created_at",
        header: "Time",
        render: (row) => (
          <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-[11px] font-medium">{row.created_at}</span>
          </div>
        ),
        width: "180px",
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6 h-[calc(100vh-80px)] animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            System Alerts
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Monitoring and logging all tactical network events
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {notifications.length === 0 && !loading ? (
          <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-white/5 shadow-xl shadow-slate-200/20 dark:shadow-none overflow-hidden h-full flex flex-col items-center justify-center text-center">
            <div className="h-16 w-16 rounded-full bg-slate-50 dark:bg-white/[0.02] flex items-center justify-center mb-4">
              <Bell className="h-8 w-8 text-slate-200 dark:text-slate-800" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              All Clear
            </h3>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              No system notifications to display at this time.
            </p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={notifications}
            loading={loading}
            rowKey={(row) => row.notification_id}
            pageSize={15}
          />
        )}
      </div>
    </div>
  );
}
