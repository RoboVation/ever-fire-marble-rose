import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MlMap } from "maplibre-gl";

export type MapLine = {
  id: string;
  color: string;
  width: number;
  coordinates: [number, number][];
};

export type MapPoint = {
  id: string;
  lng: number;
  lat: number;
  title: string;
  subtitle: string;
  detail?: string;
};

type Props = {
  theme: "light" | "dark";
  lines: MapLine[];
  stops: MapPoint[];
  vehicles: MapPoint[];
  user: { lng: number; lat: number } | null;
  fitKey: string | null;
  fitCoordinates: [number, number][] | null;
  onSelectStop?: (id: string) => void;
  onMove?: (center: { lng: number; lat: number }) => void;
  failedLabel: string;
};

const STYLE = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

function collection(points: MapPoint[], kind: string) {
  return {
    type: "FeatureCollection" as const,
    features: points.map((point) => ({
      type: "Feature" as const,
      properties: {
        id: point.id,
        title: point.title,
        subtitle: point.subtitle,
        detail: point.detail ?? "",
        kind,
      },
      geometry: { type: "Point" as const, coordinates: [point.lng, point.lat] },
    })),
  };
}

function popupNode(title: string, subtitle: string, detail: string) {
  const root = document.createElement("div");
  root.className = "grid max-w-56 gap-1";
  const heading = document.createElement("p");
  heading.className = "text-sm font-medium";
  heading.textContent = title;
  const sub = document.createElement("p");
  sub.className = "text-xs text-muted";
  sub.textContent = subtitle;
  root.append(heading, sub);
  if (detail) {
    const extra = document.createElement("p");
    extra.className = "text-xs";
    extra.textContent = detail;
    root.append(extra);
  }
  return root;
}

export function TransitMap({
  theme,
  lines,
  stops,
  vehicles,
  user,
  fitKey,
  fitCoordinates,
  onSelectStop,
  onMove,
  failedLabel,
}: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const selectRef = useRef(onSelectStop);
  const moveRef = useRef(onMove);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  selectRef.current = onSelectStop;
  moveRef.current = onMove;

  useEffect(() => {
    let dead = false;
    let map: MlMap | null = null;
    setReady(false);
    setFailed(false);
    void (async () => {
      try {
        const ml = await import("maplibre-gl");
        if (dead || !holder.current) return;
        map = new ml.Map({
          container: holder.current,
          style: STYLE[theme],
          center: [79.8612, 6.9271],
          zoom: 11.4,
          attributionControl: {},
          dragRotate: false,
          pitchWithRotate: false,
        });
        map.addControl(new ml.AttributionControl({ compact: true }), "bottom-left");
        mapRef.current = map;
        map.on("load", () => {
          if (dead || !map) return;
          map.addSource("lines", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });
          map.addLayer({
            id: "lines",
            type: "line",
            source: "lines",
            paint: {
              "line-color": ["get", "color"],
              "line-width": ["get", "width"],
              "line-opacity": 0.9,
            },
          });
          map.addSource("stops", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({
            id: "stops",
            type: "circle",
            source: "stops",
            paint: {
              "circle-radius": 5,
              "circle-color": "#fffcf8",
              "circle-stroke-color": "#1c1917",
              "circle-stroke-width": 2,
            },
          });
          map.addSource("vehicles", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({
            id: "vehicles",
            type: "circle",
            source: "vehicles",
            paint: {
              "circle-radius": 7,
              "circle-color": "#1e3a5f",
              "circle-stroke-color": "#f7f4ee",
              "circle-stroke-width": 2,
            },
          });
          map.addSource("user", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          map.addLayer({
            id: "user",
            type: "circle",
            source: "user",
            paint: { "circle-radius": 7, "circle-color": "#1f6b45", "circle-stroke-color": "#f7f4ee", "circle-stroke-width": 2 },
          });
          map.on("click", "stops", (event) => {
            const id = event.features?.[0]?.properties?.id;
            if (id) selectRef.current?.(String(id));
          });
          map.on("click", "vehicles", (event) => {
            const feature = event.features?.[0];
            const props = feature?.properties;
            if (!map || !props) return;
            const coordinates = (feature.geometry as { coordinates: [number, number] }).coordinates;
            new ml.Popup({ closeButton: true, maxWidth: "240px" })
              .setLngLat(coordinates)
              .setDOMContent(popupNode(String(props.title ?? ""), String(props.subtitle ?? ""), String(props.detail ?? "")))
              .addTo(map);
          });
          map.on("mouseenter", "stops", () => {
            if (map) map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", "stops", () => {
            if (map) map.getCanvas().style.cursor = "";
          });
          map.on("moveend", () => {
            if (!map) return;
            const center = map.getCenter();
            moveRef.current?.({ lng: center.lng, lat: center.lat });
          });
          setReady(true);
        });
      } catch {
        if (!dead) setFailed(true);
      }
    })();
    return () => {
      dead = true;
      map?.remove();
      mapRef.current = null;
    };
  }, [theme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const lineSource = map.getSource("lines") as GeoJSONSource | undefined;
    lineSource?.setData({
      type: "FeatureCollection",
      features: lines.map((line) => ({
        type: "Feature",
        properties: { id: line.id, color: line.color, width: line.width },
        geometry: { type: "LineString", coordinates: line.coordinates },
      })),
    });
    (map.getSource("stops") as GeoJSONSource | undefined)?.setData(collection(stops, "stop"));
    (map.getSource("vehicles") as GeoJSONSource | undefined)?.setData(collection(vehicles, "vehicle"));
    (map.getSource("user") as GeoJSONSource | undefined)?.setData(
      user
        ? collection([{ id: "user", lng: user.lng, lat: user.lat, title: "", subtitle: "" }], "user")
        : { type: "FeatureCollection", features: [] },
    );
  }, [ready, lines, stops, vehicles, user]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !fitKey || !fitCoordinates || fitCoordinates.length < 2) return;
    const lngs = fitCoordinates.map((item) => item[0]);
    const lats = fitCoordinates.map((item) => item[1]);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 48, maxZoom: 14, duration: 400 },
    );
  }, [ready, fitKey, fitCoordinates]);

  return (
    <div className="relative h-full w-full bg-surface-2">
      <div ref={holder} className="h-full w-full" />
      {failed ? (
        <p className="absolute inset-x-4 top-4 rounded-md border border-border bg-surface p-3 text-sm">
          {failedLabel}
        </p>
      ) : null}
    </div>
  );
}
