"use client";

import { useRef } from "react";
import { useMapEvents } from "react-leaflet";

export function CoordinateTracker({
  onCoordChange,
}: {
  onCoordChange: (lat: number, lng: number) => void;
}) {
  const lastUpdate = useRef(0);
  useMapEvents({
    mousemove(e) {
      const now = Date.now();
      if (now - lastUpdate.current > 100) {
        lastUpdate.current = now;
        onCoordChange(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}
