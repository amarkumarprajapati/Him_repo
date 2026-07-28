export function normalizeBrowserUrl(raw: unknown): string {
  if (raw == null) return "about:blank";

  const value =
    typeof raw === "string"
      ? raw
      : typeof raw === "number" || typeof raw === "boolean"
        ? String(raw)
        : "";

  const trimmed = value.trim();
  if (!trimmed) return "about:blank";

  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function canEmbedDirectly(url: unknown, origin?: string): boolean {
  const normalized = normalizeBrowserUrl(url);
  if (normalized === "about:blank") return true;

  try {
    const target = new URL(normalized);
    if (target.protocol === "about:") return true;
    const appOrigin =
      origin ?? (typeof window !== "undefined" ? window.location.origin : "");
    if (!appOrigin) return false;
    return target.origin === appOrigin;
  } catch {
    return false;
  }
}

export function toEmbeddedFrameSrc(url: unknown): string {
  const normalized = normalizeBrowserUrl(url);
  if (normalized === "about:blank") return normalized;
  if (canEmbedDirectly(normalized)) return normalized;
  return `/api/browser/proxy?url=${encodeURIComponent(normalized)}`;
}
