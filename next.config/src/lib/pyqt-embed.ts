export function isPyQtDesktop(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent.includes("HimshravanPyQt/1");
}

type PyQtWindow = Window & {
  __pyqtClearEmbeds?: () => void;
};

export function getPyQtApi(): Window["pyqtAPI"] | null {
  if (typeof window === "undefined") return null;
  return window.pyqtAPI ?? null;
}

export function clearAllPyQtEmbeds(): void {
  if (typeof window === "undefined") return;
  const pyqtWindow = window as PyQtWindow;
  if (pyqtWindow.__pyqtClearEmbeds) {
    pyqtWindow.__pyqtClearEmbeds();
    return;
  }
  getPyQtApi()?.hideEmbedded("");
}

export function scheduleAfterLayout(task: () => void): () => void {
  let cancelled = false;
  let raf2 = 0;
  const raf1 = requestAnimationFrame(() => {
    raf2 = requestAnimationFrame(() => {
      if (!cancelled) task();
    });
  });
  return () => {
    cancelled = true;
    cancelAnimationFrame(raf1);
    if (raf2) cancelAnimationFrame(raf2);
  };
}
