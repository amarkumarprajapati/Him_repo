"use client";

import {
  Bell,
  ChevronDown,
  LogOut,
  Moon,
  Sun,
  User,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUi } from "./ui-context";
import { showToast } from "@/utils/toast";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { logoutUser } from "@/store/slices/authSlice";
import { readAllNotifications } from "@/store/slices/notificationSlice";
import { markAsRead } from "@/api/notifications";

const NOTIF_DOT: Record<string, string> = {
  CRITICAL: "bg-red-500",
  HIGH: "bg-red-500",
  MEDIUM: "bg-amber-500",
  LOW: "bg-emerald-500",
  error: "bg-red-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  info: "bg-sky-500",
};


export function TopHeader() {
  const { theme, toggleTheme, isEventsOpen, toggleEvents, isSidebarOpen } =
    useUi();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const notifications = useAppSelector(
    (state) => state.notifications.notifications,
  );
  const notifLoading = useAppSelector((state) => state.notifications.loading);

  useEffect(() => {
    if (isNotifOpen && notifications.some((n) => n.status === "UNREAD")) {
      dispatch(readAllNotifications());
    }
  }, [isNotifOpen, notifications, dispatch]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = () => {
    setIsUserMenuOpen(false);
    dispatch(logoutUser()).then(() => {
      showToast.info("Signed out.");
      router.replace("/login");
    });
  };

  const unreadCount = notifications.filter((n) => n.status === "UNREAD").length;

  return (
    <header
      className="h-[60px] flex items-center justify-between px-5 lg:px-8 bg-white dark:bg-[#1e293b]/95 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 shrink-0 transition-colors relative z-[1000]"
    >
      <div className="flex items-center gap-3 min-w-0">
        {!isSidebarOpen && (
          <>
            <div className="flex items-center justify-center w-7 h-7 shrink-0">
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 bg-[#4ade80] opacity-10 blur-2xl rounded-full h-7 w-7" />
                <img
                  src={theme === "dark" ? "/LntLogoDark.svg":"/LntLogoLight.svg"}
                  alt="L&T Logo"
                  className="h-9 w-auto object-contain"
                />
              </div>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] font-bold text-slate-900 dark:text-white leading-tight tracking-wide">
                HIMSHRAVAN
              </span>
              <span className="text-[9px] text-slate-500 dark:text-slate-400 leading-tight">
                EW Command Post Surveillance system ( EWCPS )
              </span>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-1">
      
        {/* Events Toggle */}
        <button
          type="button"
          onClick={toggleEvents}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer border backdrop-blur-sm
          ${isEventsOpen
              ? "text-black-500 dark:text-blue-400 border-blue-400"
              : "text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800/60"
            }`}
          title="Toggle events panel"
        >
          <span className="hidden sm:inline">Events</span>
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 relative cursor-pointer"
            title="Notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white border-2 border-white dark:border-[#080c14]">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-white/10 shadow-2xl z-[7000] overflow-hidden animate-modal-in">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  Notifications
                </span>
                <button
                  onClick={() => dispatch(readAllNotifications())}
                  className="text-[10px] text-slate-400 font-medium cursor-pointer hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors"
                >
                  Mark all read
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto custom-scrollbar">
                {notifLoading && notifications.length === 0 ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 px-4 py-3 border-b border-slate-100 dark:border-white/3 last:border-0"
                    >
                      <div className="mt-1.5 h-2 w-2 rounded-full shrink-0 bg-slate-200 dark:bg-white/10 animate-pulse" />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="h-3 w-3/4 rounded bg-slate-200 dark:bg-white/10 animate-pulse" />
                        <div className="h-2.5 w-1/2 rounded bg-slate-200 dark:bg-white/10 animate-pulse" />
                      </div>
                    </div>
                  ))
                ) : notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                    No notifications
                  </div>
                ) : (
                  notifications.slice(0, 10).map((notif) => (
                    <div
                      key={notif.notification_id}
                      onClick={() => {
                        if (notif.status === "UNREAD") {
                          markAsRead(notif.notification_id);
                        }
                      }}
                      className={`flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer border-b border-slate-100 dark:border-white/3 last:border-0 ${notif.status === "UNREAD"
                        ? "bg-slate-50 dark:bg-white/2"
                        : ""
                        }`}
                    >
                      <span
                        className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${NOTIF_DOT[notif.priority] || "bg-slate-400"}`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                          {notif.title}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                          {notif.message}
                        </p>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          {notif.created_at}
                        </span>
                      </div>
                      {notif.status === "UNREAD" && (
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-sky-500 shrink-0" />
                      )}
                    </div>
                  ))
                )}
              </div>
              <div className="px-4 py-2.5 border-t border-slate-100 dark:border-white/5">
                <button
                  onClick={() => {
                    setIsNotifOpen(false);
                    router.push("/map-view/notifications");
                  }}
                  className="w-full text-center text-[11px] font-medium text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                >
                  View All Notifications
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="w-px h-6 bg-slate-200 dark:bg-white/10 mx-1" />

        {/* User menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-white/5 p-1.5 rounded-lg transition-colors -mr-2 cursor-pointer"
          >
            <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center overflow-hidden border border-slate-200 dark:border-white/10">
              <User className="h-4 w-4 text-slate-600 dark:text-slate-300" />
            </div>
            <div className="flex-col items-start hidden sm:flex">
              <span className="text-sm font-semibold text-slate-900 dark:text-white leading-none mb-1">
                {user?.username || "ADMIN"}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-none">
                {user?.role || "Administrator"}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-500 dark:text-slate-400 ml-1" />
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-white/5 shadow-2xl py-1 z-[7000] animate-modal-in">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
          aria-label="Toggle theme"
          title={
            theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
          }
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>
      </div>
    </header>
  );
}