"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { useAppDispatch } from "@/store/hooks";
import { setMapView } from "@/store/slices/mapSlice";

export function MapStateSync() {
  const dispatch = useAppDispatch();
  const map = useMap();
  useEffect(() => {
    const syncState = () => {
      const c = map.getCenter();
      dispatch(setMapView({ center: [c.lat, c.lng], zoom: map.getZoom() }));
    };
    map.on("moveend", syncState);
    map.on("zoomend", syncState);
    return () => {
      map.off("moveend", syncState);
      map.off("zoomend", syncState);
    };
  }, [map, dispatch]);
  return null;
}
