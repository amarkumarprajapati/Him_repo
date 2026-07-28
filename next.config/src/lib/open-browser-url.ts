import { normalizeBrowserUrl } from "@/lib/browser-proxy";

export function openBrowserUrlInNewTab(url: unknown, label = ""): void {
  const normalized = normalizeBrowserUrl(url);
  if (normalized === "about:blank" || typeof window === "undefined") return;

  const pyqtAPI = window.pyqtAPI;
  if (pyqtAPI?.openInNewTab) {
    pyqtAPI.openInNewTab(normalized, label);
    return;
  }

  window.open(normalized, "_blank", "noopener,noreferrer");
}
