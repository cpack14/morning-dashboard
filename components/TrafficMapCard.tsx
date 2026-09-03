"use client";

import { useEffect, useRef, useState } from "react";
import { Card, Unavailable } from "@/components/Card";
import type * as TT from "@tomtom-international/web-sdk-maps";

const REFRESH_MS = 5 * 60 * 1000;

function toLngLat(raw: string): [number, number] {
  const [lat, lon] = raw.split(",").map(Number);
  return [lon, lat];
}

function makeMarkerIcon(emoji: string, background: string): HTMLElement {
  const el = document.createElement("div");
  el.textContent = emoji;
  Object.assign(el.style, {
    width: "1.1rem",
    height: "1.1rem",
    borderRadius: "50%",
    background,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.6rem",
    boxShadow: "0 0 0 1.5px rgba(255,255,255,0.85)",
  });
  return el;
}

export function TrafficMapCard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_TOMTOM_API_KEY;
  const homeCoords = process.env.NEXT_PUBLIC_HOME_COORDS;
  const workCoords = process.env.NEXT_PUBLIC_WORK_COORDS;

  useEffect(() => {
    if (!apiKey || !homeCoords || !workCoords || !containerRef.current) return;

    let cancelled = false;
    let refreshTimer: ReturnType<typeof setInterval> | undefined;
    let map: TT.Map | undefined;

    const origin = toLngLat(homeCoords);
    const destination = toLngLat(workCoords);

    (async () => {
      const [{ default: tt }] = await Promise.all([
        import("@tomtom-international/web-sdk-maps"),
        import("@tomtom-international/web-sdk-maps/dist/maps.css"),
      ]);
      const services = await import("@tomtom-international/web-sdk-services");

      if (cancelled || !containerRef.current) return;

      map = tt.map({
        key: apiKey,
        container: containerRef.current,
        center: origin,
        zoom: 11,
        interactive: false,
      });

      map.on("load", () => {
        map?.showTrafficFlow();
        new tt.Marker({ element: makeMarkerIcon("🏠", "#5b9dff") })
          .setLngLat(origin)
          .addTo(map!);
        new tt.Marker({ element: makeMarkerIcon("💼", "#4ade80") })
          .setLngLat(destination)
          .addTo(map!);
      });

      const drawRoute = async () => {
        try {
          const response = await services.services.calculateRoute({
            key: apiKey,
            locations: [origin, destination],
            routeType: "fastest",
          });
          if (cancelled || !map) return;

          const geojson = response.toGeoJson();
          const source = map.getSource("route") as TT.GeoJSONSource | undefined;
          if (source) {
            source.setData(geojson);
          } else {
            map.addSource("route", { type: "geojson", data: geojson });
            map.addLayer({
              id: "route-line",
              type: "line",
              source: "route",
              paint: { "line-color": "#5b9dff", "line-width": 3, "line-opacity": 0.55 },
            });
          }

          const coords = (geojson.features[0]?.geometry as GeoJSON.LineString | undefined)
            ?.coordinates as [number, number][] | undefined;
          if (coords?.length) {
            const bounds = coords.reduce(
              (b, c) => b.extend(c),
              new tt.LngLatBounds(coords[0], coords[0]),
            );
            map.fitBounds(bounds, { padding: 30 });
          }

          setError(null);
        } catch (err) {
          if (!cancelled) setError((err as Error).message);
        }
      };

      map.on("load", drawRoute);
      refreshTimer = setInterval(drawRoute, REFRESH_MS);
    })();

    return () => {
      cancelled = true;
      if (refreshTimer) clearInterval(refreshTimer);
      map?.remove();
    };
  }, [apiKey, homeCoords, workCoords]);

  if (!apiKey || !homeCoords || !workCoords) {
    return (
      <Card title="Traffic">
        <Unavailable reason="NEXT_PUBLIC_TOMTOM_API_KEY / NEXT_PUBLIC_HOME_COORDS / NEXT_PUBLIC_WORK_COORDS not configured" />
      </Card>
    );
  }

  return (
    <Card title="Traffic">
      <div className="flex h-full flex-col">
        {error && (
          <p className="text-label shrink-0 pb-[0.5vh] text-accent-warn">
            Route unavailable — {error}
          </p>
        )}
        <div ref={containerRef} className="min-h-0 w-full flex-1" />
      </div>
    </Card>
  );
}
