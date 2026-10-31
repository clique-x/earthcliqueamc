"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoJSONSource, Map as MlMap, Marker, StyleSpecification } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { LatLng } from "@/lib/types";
import { cn } from "@/lib/utils";

export type MarkerTone = "primary" | "success" | "warning" | "info" | "danger" | "muted";

export type MapMarker = LatLng & { id: string; tone: MarkerTone; label?: string; size?: "sm" | "lg"; onClick?: () => void };

const TONE_CLASS: Record<MarkerTone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
  danger: "bg-destructive",
  muted: "bg-muted-foreground",
};

// OpenStreetMap raster tiles — fine for development; use a commercial tile provider in production.
const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

/** Resolves a CSS colour token (any syntax the browser supports) to rgb() for MapLibre paint properties. */
function resolveColor(token: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx || !raw) return "rgb(0,0,0)";
  ctx.fillStyle = raw;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${r},${g},${b})`;
}

function markerElement(m: MapMarker) {
  const el = document.createElement("div");
  el.className = cn(
    "rounded-full border-2 border-background shadow-md",
    m.size === "lg" ? "size-5" : "size-3.5",
    TONE_CLASS[m.tone],
    m.onClick && "cursor-pointer",
  );
  if (m.label) el.title = m.label;
  if (m.onClick) el.addEventListener("click", m.onClick);
  return el;
}

type Props = {
  markers: MapMarker[];
  route?: LatLng[];
  center?: LatLng;
  zoom?: number;
  /** Change this value to re-fit the view to all markers (e.g. when the set of markers changes). */
  fitKey?: string;
  onPick?: (point: LatLng) => void;
  className?: string;
};

export function MapView({ markers, route = [], center, zoom = 12, fitKey, onPick, className }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const libRef = useRef<typeof import("maplibre-gl") | null>(null);
  const markerRefs = useRef(new Map<string, { marker: Marker; key: string }>());
  const pickRef = useRef(onPick);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    pickRef.current = onPick;
  });

  useEffect(() => {
    let cancelled = false;
    const markersById = markerRefs.current;
    void import("maplibre-gl").then((lib) => {
      if (cancelled || !container.current) return;
      // Bundlers relocate maplibre's chunk, so its relative worker URL breaks; serve the worker from /public.
      lib.setWorkerUrl("/maplibre-gl-worker.mjs");
      libRef.current = lib;
      const start = center ?? markers[0] ?? { lat: 22.9734, lng: 78.6569 };
      const map = new lib.Map({ container: container.current, style: STYLE, center: [start.lng, start.lat], zoom: center || markers[0] ? zoom : 4 });
      map.addControl(new lib.NavigationControl({ showCompass: false }), "top-right");
      map.on("click", (e) => pickRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
      map.on("load", () => {
        map.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: "route",
          type: "line",
          source: "route",
          paint: { "line-color": resolveColor("--info"), "line-width": 4, "line-opacity": 0.8 },
          layout: { "line-cap": "round", "line-join": "round" },
        });
        setReady(true);
      });
      mapRef.current = map;
    });
    return () => {
      cancelled = true;
      markersById.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // The map is created once; markers/center updates are handled by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib) return;
    const seen = new Set<string>();
    for (const m of markers) {
      seen.add(m.id);
      const styleKey = `${m.tone}|${m.size}|${m.label}`;
      const existing = markerRefs.current.get(m.id);
      if (existing && existing.key === styleKey) {
        existing.marker.setLngLat([m.lng, m.lat]);
        continue;
      }
      existing?.marker.remove();
      const marker = new lib.Marker({ element: markerElement(m) }).setLngLat([m.lng, m.lat]).addTo(map);
      markerRefs.current.set(m.id, { marker, key: styleKey });
    }
    for (const [id, { marker }] of markerRefs.current) {
      if (!seen.has(id)) {
        marker.remove();
        markerRefs.current.delete(id);
      }
    }
  }, [markers, ready]);

  useEffect(() => {
    const source = mapRef.current?.getSource("route") as GeoJSONSource | undefined;
    if (!ready || !source) return;
    source.setData({
      type: "FeatureCollection",
      features: route.length > 1 ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: route.map((p) => [p.lng, p.lat]) } }] : [],
    });
  }, [route, ready]);

  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib || markers.length === 0) return;
    if (markers.length === 1) {
      map.easeTo({ center: [markers[0]!.lng, markers[0]!.lat], zoom: Math.max(map.getZoom(), 13) });
      return;
    }
    const bounds = new lib.LngLatBounds();
    for (const m of markers) bounds.extend([m.lng, m.lat]);
    map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 500 });
    // Only refit when the caller says the marker set changed, not on every position update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, ready]);

  useEffect(() => {
    if (ready && center) mapRef.current?.easeTo({ center: [center.lng, center.lat] });
  }, [center, ready]);

  return <div ref={container} className={cn("h-80 w-full overflow-hidden rounded-xl border", className)} />;
}
