"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Users,
  Settings,
  ChevronDown,
  ChevronLeft,
  Menu,
  Clock,
  Monitor,
  FileDown,
  Globe,
} from "lucide-react";
import { useState } from "react";
import { useTheme } from "next-themes";
import { useUi } from "./ui-context";
import { clearAllPyQtEmbeds, isPyQtDesktop } from "@/lib/pyqt-embed";
import { useAppSelector } from "@/store/hooks";

type MenuItem = {
  name: string;
  icon: any;
  href?: string;
  children?: MenuItem[];
  badge?: string | number;
  description?: string;
};

const MENU_ITEMS: MenuItem[] = [
  { name: "Map View", icon: Home, href: "/map-view" },
  { name: "Global Site View", icon: Globe, href: "/map-view/station-view" },
  // { name: "Status", icon: Activity, href: "/map-view/status" },
  { name: "CSV List", icon: FileDown, href: "/map-view/csv-list" },
  //{ name: "Sessions", icon: Clock, href: "/map-view/sessions" },
  { name: "System", icon: Monitor, href: "/map-view/system" },
  {
    name: "Settings",
    icon: Settings,
    children: [
      { name: "User Management", icon: Users, href: "/map-view/users" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isSidebarOpen, toggleSidebar, mounted } = useUi();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    Status: true,
    Settings: true,
  });
  const { theme } = useTheme();
  const user = useAppSelector((state) => state.auth.user);

  const filteredMenuItems = MENU_ITEMS.filter((item) => {
    if (item.name === "Settings") {
      return user?.role === "SUPER_ADMIN";
    }
    if (item.name === "CSV List") {
      return user?.role === "SUPER_ADMIN";
    }
    return true;
  });

  if (!mounted) return null;

  const clearEmbedsBeforeNav = () => {
    if (isPyQtDesktop()) clearAllPyQtEmbeds();
  };

  return (
    <aside
      className={`relative flex-shrink-0 z-40 ${isSidebarOpen ? "w-[260px]" : "w-[76px]"} flex flex-col bg-white dark:bg-[#1e293b]/95 backdrop-blur-xl border-r border-slate-200 dark:border-white/5 h-screen overflow-y-auto overflow-x-hidden custom-scrollbar transition-all duration-300 ease-in-out`}
    >
      <div
        className={`h-16 flex items-center border-b border-slate-200 dark:border-white/5 shrink-0 sticky top-0 bg-white dark:bg-[#1e293b] z-10 ${isSidebarOpen ? "px-3 gap-3" : "justify-center"}`}
      >
        {isSidebarOpen && (
          <>
            <div className="flex items-center justify-center w-7 h-7 shrink-0">
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 bg-[#4ade80] opacity-10 blur-2xl rounded-full h-7 w-7" />
                <img
                  src={theme === "dark" ? "/LntLogoDark.svg" : "/LntLogoLight.svg"}
                  alt="L&T Logo"
                  className="h-9 w-auto object-contain"
                />
              </div>
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-[13px] font-bold text-slate-900 dark:text-white leading-tight tracking-wide">
                HIMSHRAVAN
              </span>
              <span className="text-[9px] text-slate-500 dark:text-slate-400 leading-tight">
                EW Command Post Surveillance system ( EWCPS )
              </span>
            </div>
          </>
        )}
        <button
          onClick={toggleSidebar}
          className={`p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors duration-150 cursor-pointer shrink-0 ${isSidebarOpen ? "ml-auto" : ""}`}
          aria-label="Toggle sidebar"
          title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {isSidebarOpen ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav
        className={`${isSidebarOpen ? "px-3" : "px-2"} flex-1 py-4 space-y-0.5`}
      >
        {filteredMenuItems?.map((item) => {
          const isActive = item.href ? pathname === item.href : false;
          const hasChildren = !!item.children;
          const isOpen = openMenus[item.name];
          const isChildActive = item.children?.some(
            (c) => pathname === c.href || pathname?.startsWith(`${c.href}/`),
          );

          if (!hasChildren) {
            return (
              <Link
                key={item.name}
                href={item.href!}
                onClick={clearEmbedsBeforeNav}
                className={`flex items-center cursor-pointer ${isSidebarOpen ? "gap-3 px-3" : "justify-center px-2"} py-2.5 rounded-lg transition-colors duration-150 relative group ${isActive
                  ? "bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
                  }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-emerald-400 rounded-r-full" />
                )}
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                {isSidebarOpen && (
                  <span className={`text-[13px] ${isActive ? "font-semibold" : "font-medium"}`}>{item.name}</span>
                )}
                {isSidebarOpen && item.badge && (
                  <span className="ml-auto flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                    {item.badge}
                  </span>
                )}
                {!isSidebarOpen && item.badge && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
                {!isSidebarOpen && (
                  <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-md bg-slate-800 dark:bg-[#0f172a] text-white text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none shadow-lg border border-slate-700 dark:border-white/10 z-[100]">
                    {item.name}
                  </span>
                )}
              </Link>
            );
          }

          return (
            <div key={item.name}>
              <button
                onClick={() => {
                  if (!isSidebarOpen) {
                    if (item.children && item.children.length > 0 && item.children[0].href) {
                      clearEmbedsBeforeNav();
                      router.push(item.children[0].href);
                    }
                  } else {
                    setOpenMenus((prev) => ({
                      ...prev,
                      [item.name]: !prev[item.name],
                    }));
                  }
                }}
                className={`w-full flex items-center cursor-pointer relative group ${isSidebarOpen ? "justify-between px-3" : "justify-center px-2"} py-2.5 rounded-lg transition-colors duration-150 ${isChildActive
                  ? "text-emerald-700 dark:text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
                  }`}
              >
                <div
                  className={`flex items-center ${isSidebarOpen ? "gap-3" : ""}`}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  {isSidebarOpen && (
                    <span className={`text-[13px] ${isChildActive ? "font-semibold" : "font-medium"}`}>
                      {item.name}
                    </span>
                  )}
                </div>
                {isSidebarOpen && (
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-150 ${isChildActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-white"} ${isOpen ? "" : "-rotate-90"}`}
                  />
                )}
                {!isSidebarOpen && (
                  <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-md bg-slate-800 dark:bg-[#0f172a] text-white text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none shadow-lg border border-slate-700 dark:border-white/10 z-[100]">
                    {item.name}
                  </span>
                )}
              </button>

              {isSidebarOpen && (
                <div
                  className={`grid transition-all duration-150 ease-out ${isOpen ? "grid-rows-[1fr] opacity-100 mt-0.5" : "grid-rows-[0fr] opacity-0 mt-0"}`}
                >
                  <div className="overflow-hidden">
                    <div className="ml-9 flex flex-col gap-0.5 border-l border-slate-200 dark:border-white/10 pl-3 py-1">
                      {item.children?.map((child) => {
                        const ChildIcon = child.icon;
                        const isActiveChild =
                          pathname === child.href ||
                          pathname?.startsWith(`${child.href}/`);

                        return (
                          child.href && (
                            <Link
                              key={child.name}
                              href={child.href}
                              onClick={clearEmbedsBeforeNav}
                              className={`flex items-center gap-2 px-2 py-1.5 rounded text-[12px] transition-colors duration-150 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-emerald-400/60 ${isActiveChild
                                ? "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 font-semibold"
                                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 font-medium"
                                }`}
                            >
                              {ChildIcon ? (
                                <ChildIcon className="h-4 w-4 shrink-0" />
                              ) : (
                                <span className="h-4 w-4 shrink-0" />
                              )}
                              <span className="flex flex-col leading-tight">
                                <span className="whitespace-nowrap">{child.name}</span>
                                {child.description && (
                                  <span className="mt-0.5 text-[10px] font-normal text-slate-500 dark:text-slate-400">
                                    {child.description}
                                  </span>
                                )}
                              </span>
                            </Link>
                          )
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>

    </aside>
  );
}
