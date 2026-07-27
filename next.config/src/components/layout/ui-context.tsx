"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ThemeMode = "light" | "dark";

interface UiContextValue {
  theme: ThemeMode;
  isSidebarOpen: boolean;
  isEventsOpen: boolean;
  isRightPanelOpen: boolean;
  rightPanelNode: any | null;
  mounted: boolean;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  toggleEvents: () => void;
  setEventsOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean, node?: any) => void;
}

const UiContext = createContext<UiContextValue | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isEventsOpen, setIsEventsOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [rightPanelNode, setRightPanelNode] = useState<any | null>(null);

  useEffect(() => {
    setMounted(true);
    const storedTheme = window.localStorage.getItem("himshravan-theme") as ThemeMode | null;
    if (storedTheme === "light" || storedTheme === "dark") {
      setTheme(storedTheme);
    }
    const storedSidebar = window.localStorage.getItem("himshravan-sidebar");
    if (storedSidebar === "false") {
      setIsSidebarOpen(false);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("himshravan-theme", theme);
  }, [theme, mounted]);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem("himshravan-sidebar", String(isSidebarOpen));
  }, [isSidebarOpen, mounted]);

  const value = useMemo(
    () => ({
      theme,
      isSidebarOpen,
      isEventsOpen,
      isRightPanelOpen,
      rightPanelNode,
      mounted,
      toggleTheme: () =>
        setTheme((current) => (current === "dark" ? "light" : "dark")),
      toggleSidebar: () => setIsSidebarOpen((current) => !current),
      toggleEvents: () => setIsEventsOpen((current) => !current),
      setEventsOpen: (open: boolean) => setIsEventsOpen(open),
      setRightPanelOpen: (open: boolean, node?: any) => {
        setIsRightPanelOpen(open);
        if (node) setRightPanelNode(node);
      },
    }),
    [theme, isSidebarOpen, isEventsOpen, isRightPanelOpen, rightPanelNode, mounted],
  );

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi() {
  const context = useContext(UiContext);

  if (!context) {
    throw new Error("useUi must be used within UiProvider");
  }

  return context;
}
