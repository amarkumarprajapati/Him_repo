"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  normalizeBrowserUrl,
  toEmbeddedFrameSrc,
} from "@/lib/browser-proxy";
import {
  clearAllPyQtEmbeds,
  getPyQtApi,
  isPyQtDesktop,
  scheduleAfterLayout,
} from "@/lib/pyqt-embed";

export type EmbeddedBrowserHandle = {
  navigate: (url: string) => Promise<void>;
  back: () => void;
  forward: () => void;
  reload: () => void;
  stop: () => void;
  getCurrentURL: () => string;
};

type EmbeddedBrowserProps = {
  url?: unknown;
  title: string;
  className?: string;
  embedId?: string;
  onLoadingChange?: (loading: boolean) => void;
  onUrlChange?: (url: string) => void;
};

type PyQtApi = NonNullable<Window["pyqtAPI"]>;

function isPyQtRuntime(api: PyQtApi | null | undefined) {
  if (!api) return isPyQtDesktop();
  if (typeof api.isPyQt === "function") return Boolean(api.isPyQt());
  if (typeof api.isPyQt === "boolean") return api.isPyQt;
  return isPyQtDesktop();
}

function readPyQtBounds(container: HTMLElement) {
  const rect = container.getBoundingClientRect();
  return {
    x: Math.round(rect.left),
    y: Math.round(rect.top),
    width: Math.max(Math.round(rect.width), 1),
    height: Math.max(Math.round(rect.height), 1),
  };
}

async function normalizeWithPyQt(api: PyQtApi, target: unknown): Promise<string> {
  const raw = target == null ? "" : String(target);
  if (typeof api.normalizeUrl === "function") {
    const result = await Promise.resolve(api.normalizeUrl(raw) as unknown);
    return normalizeBrowserUrl(result);
  }
  return normalizeBrowserUrl(raw);
}

export const EmbeddedBrowser = forwardRef<EmbeddedBrowserHandle, EmbeddedBrowserProps>(
  ({ url, title, className, embedId, onLoadingChange, onUrlChange }, ref) => {
    const initialUrl = normalizeBrowserUrl(url);
    const [iframeKey, setIframeKey] = useState(0);
    const [currentUrl, setCurrentUrl] = useState(initialUrl);
    const [frameSrc, setFrameSrc] = useState(() => toEmbeddedFrameSrc(initialUrl));
    const pyqtApi = getPyQtApi();
    const isPyQt = isPyQtRuntime(pyqtApi);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const embedIdRef = useRef(embedId ?? "");
    const currentUrlRef = useRef(currentUrl);

    useEffect(() => {
      embedIdRef.current = embedId ?? "";
    }, [embedId]);

    useEffect(() => {
      currentUrlRef.current = currentUrl;
    }, [currentUrl]);

    const setUrlState = useCallback(
      (nextUrl: unknown) => {
        const normalized = normalizeBrowserUrl(nextUrl);
        setCurrentUrl(normalized);
        onUrlChange?.(normalized);
      },
      [onUrlChange],
    );

    const syncPyQtBounds = useCallback(() => {
      const api = getPyQtApi();
      if (!isPyQt || !containerRef.current || !api) return;
      const bounds = readPyQtBounds(containerRef.current);
      api.updateEmbeddedBounds(bounds.x, bounds.y, bounds.width, bounds.height, embedIdRef.current);
    }, [isPyQt]);

    const showPyQtEmbedded = useCallback(
      (targetUrl: string) => {
        const api = getPyQtApi();
        if (!isPyQt || !containerRef.current || !api) return;
        const bounds = readPyQtBounds(containerRef.current);
        api.showEmbedded(
          bounds.x,
          bounds.y,
          bounds.width,
          bounds.height,
          targetUrl,
          embedIdRef.current,
        );
      },
      [isPyQt],
    );

    const hidePyQtEmbedded = useCallback(() => {
      const id = embedIdRef.current;
      if (id) {
        getPyQtApi()?.hideEmbedded(id);
        return;
      }
      clearAllPyQtEmbeds();
    }, []);

    const presentPyQtEmbedded = useCallback(
      (targetUrl: string) => {
        if (targetUrl === "about:blank") {
          hidePyQtEmbedded();
          return;
        }
        return scheduleAfterLayout(() => {
          showPyQtEmbedded(targetUrl);
          syncPyQtBounds();
        });
      },
      [hidePyQtEmbedded, showPyQtEmbedded, syncPyQtBounds],
    );

    const navigate = useCallback(
      async (target: string) => {
        try {
          let normalized = normalizeBrowserUrl(target);
          const pyqtApi = getPyQtApi();
          const usePyQt = isPyQtRuntime(pyqtApi);

          if (pyqtApi) {
            normalized = await normalizeWithPyQt(pyqtApi, target);
          }

          if (usePyQt && pyqtApi) {
            onLoadingChange?.(true);
            setUrlState(normalized);
            presentPyQtEmbedded(normalized);
            onLoadingChange?.(false);
            return;
          }

          onLoadingChange?.(true);
          setUrlState(normalized);
          setFrameSrc(toEmbeddedFrameSrc(normalized));
          setIframeKey((value) => value + 1);
        } catch {
          onLoadingChange?.(false);
        }
      },
      [onLoadingChange, presentPyQtEmbedded, setUrlState],
    );

    const back = useCallback(() => {
      getPyQtApi()?.embeddedBack(embedIdRef.current);
    }, []);

    const forward = useCallback(() => {
      getPyQtApi()?.embeddedForward(embedIdRef.current);
    }, []);

    const reload = useCallback(() => {
      onLoadingChange?.(true);
      if (isPyQt) {
        getPyQtApi()?.embeddedReload(embedIdRef.current);
        onLoadingChange?.(false);
        return;
      }
      setIframeKey((value) => value + 1);
    }, [isPyQt, onLoadingChange]);

    const stop = useCallback(() => {
      if (isPyQt) {
        getPyQtApi()?.embeddedStop(embedIdRef.current);
      } else {
        iframeRef.current?.contentWindow?.stop();
      }
      onLoadingChange?.(false);
    }, [isPyQt, onLoadingChange]);

    const getCurrentURL = useCallback(() => currentUrl, [currentUrl]);

    useImperativeHandle(
      ref,
      () => ({ navigate, back, forward, reload, stop, getCurrentURL }),
      [navigate, back, forward, reload, stop, getCurrentURL],
    );

    useEffect(() => {
      void navigate(normalizeBrowserUrl(url));
    }, [url, navigate]);

    useEffect(() => {
      if (!isPyQt || !containerRef.current) return;

      const sync = () => syncPyQtBounds();
      const observer = new ResizeObserver(sync);
      observer.observe(containerRef.current);
      window.addEventListener("resize", sync);
      window.addEventListener("scroll", sync, true);

      const tryShow = () => {
        const nextUrl = currentUrlRef.current;
        if (nextUrl !== "about:blank" && containerRef.current) {
          presentPyQtEmbedded(nextUrl);
        }
      };

      tryShow();
      window.addEventListener("pyqt-ready", tryShow);

      return () => {
        observer.disconnect();
        window.removeEventListener("resize", sync);
        window.removeEventListener("scroll", sync, true);
        window.removeEventListener("pyqt-ready", tryShow);
      };
    }, [isPyQt, presentPyQtEmbedded, syncPyQtBounds]);

    useLayoutEffect(() => {
      return () => {
        if (isPyQt) hidePyQtEmbedded();
      };
    }, [hidePyQtEmbedded, isPyQt]);

    if (isPyQt) {
      return (
        <div
          ref={containerRef}
          className={className}
          title={title}
          aria-label={title}
        />
      );
    }

    return (
      <iframe
        key={iframeKey}
        ref={iframeRef}
        src={frameSrc}
        className={className}
        title={title}
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        onLoad={() => onLoadingChange?.(false)}
      />
    );
  },
);

EmbeddedBrowser.displayName = "EmbeddedBrowser";
