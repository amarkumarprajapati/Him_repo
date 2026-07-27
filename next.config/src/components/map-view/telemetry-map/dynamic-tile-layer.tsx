"use client";

import { useRef, useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

function registerMapTileCacheWorker() {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !window.isSecureContext
  ) {
    return;
  }

  navigator.serviceWorker
    .register("/map-tile-cache-sw.js")
    .catch(() => undefined);
}

export function DynamicTileLayer({
  url,
  attribution,
  theme,
}: {
  url: string;
  attribution: string;
  theme: string;
}) {
  const map = useMap();
  const layerRef = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    registerMapTileCacheWorker();
  }, []);

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }
    const newLayer = L.tileLayer(url, {
      attribution,
      maxZoom: 18,
    }).addTo(map);
    layerRef.current = newLayer;

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [url, attribution, map]);

  useEffect(() => {
    map.getContainer().style.background =
      theme === "dark" ? "#0a1628" : "#e8ecf1";
  }, [theme, map]);

  return null;
}
