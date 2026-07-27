"use client";

import { usePathname } from "next/navigation";
import { useUi } from "@/components/layout/ui-context";

export function MainWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isSidebarOpen } = useUi();
  const isMapPage = pathname === "/map-view";
  const isStationViewPage = pathname === "/map-view/station-view";
  const isFullBleedPage = isMapPage || isStationViewPage;

  return (
    <main
      className={`flex min-h-0 min-w-0 flex-1 flex-col p-4 lg:p-6 ${isFullBleedPage ? "overflow-hidden" : "overflow-y-auto overflow-x-hidden custom-scrollbar"}`}
    >
      {children}
    </main>
  );
}
