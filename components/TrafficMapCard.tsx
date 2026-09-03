"use client";

import { useEffect, useRef, useState } from "react";
import { Card, Unavailable } from "@/components/Card";
import { useFetchPoll } from "@/lib/useFetchPoll";
import type * as TT from "@tomtom-international/web-sdk-maps";

const REFRESH_MS = 5 * 60 * 1000;
const COMMUTE_PLAN_POLL_MS = 60 * 1000;
const ROUTE_COLOR = "#5b9dff";
const MODERATE_DELAY_COLOR = "#f59e0b";
const SEVERE_DELAY_COLOR = "#ef4444";

type CommutePlanResponse =
  | { mode: "work" | "personal" | "church" | "bountiful"; destinationCoords: string }
  | { mode: "unavailable"; reason: string };

const DESTINATION_EMOJI: Record<string, string> = {
  work: "💼",
  church: "⛪",
};

// TomTom's traffic sections report a 0-4 magnitude: 0 unknown, 1 minor,
// 2 moderate, 3 major, 4 undefined (usually a closure). Minor/unknown
// isn't worth calling out — the route just stays its normal blue there.
function delayColor(magnitude: number | undefined): string | undefined {
  if (magnitude === 2) return MODERATE_DELAY_COLOR;
  if (magnitude !== undefined && magnitude >= 3) return SEVERE_DELAY_COLOR;
  return undefined;
}

function toLngLat(raw: string): [number, number] {
  const [lat, lon] = raw.split(",").map(Number);
  return [lon, lat];
}

type TomTomRouteSection = {
  startPointIndex: number;
  endPointIndex: number;
  sectionType: string;
  magnitudeOfDelay?: number;
};

type TomTomRoutingResponse = {
  routes: {
    legs: { points: { latitude: number; longitude: number }[] }[];
    sections?: TomTomRouteSection[];
  }[];
};

// Calls TomTom's routing REST API directly rather than going through
// @tomtom-international/web-sdk-services' calculateRoute/
// toRouteSectionsCollection helpers — that convenience method throws
// internally in the installed SDK version when traffic sections are
// requested, so we parse the raw response ourselves instead.
async function fetchRouteWithTraffic(
  apiKey: string,
  origin: [number, number],
  destination: [number, number],
): Promise<{ coords: [number, number][]; sections: TomTomRouteSection[] }> {
  const url =
    `https://api.tomtom.com/routing/1/calculateRoute/` +
    `${origin[1]},${origin[0]}:${destination[1]},${destination[0]}/json` +
    `?key=${apiKey}&routeType=fastest&traffic=true&sectionType=traffic`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`TomTom routing request failed (${res.status})`);
  const data: TomTomRoutingResponse = await res.json();

  const route = data.routes?.[0];
  if (!route) throw new Error("No route returned");

  const coords: [number, number][] = route.legs.flatMap((leg) =>
    leg.points.map((p): [number, number] => [p.longitude, p.latitude]),
  );

  return { coords, sections: route.sections ?? [] };
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
  // Used only to frame the default view when there's no active
  // destination to route to — never shown as a marker or route then.
  const fallbackFramingCoords = process.env.NEXT_PUBLIC_WORK_COORDS;

  // Mirrors whatever the Current Commute card is showing, so the map
  // always routes to the same place — work, a personal event, or the
  // Sunday church/Bountiful destinations.
  const { data: plan } = useFetchPoll<CommutePlanResponse>(
    "/api/commute-plan",
    COMMUTE_PLAN_POLL_MS,
  );
  const destinationCoords = plan && plan.mode !== "unavailable" ? plan.destinationCoords : null;
  const destinationEmoji =
    (plan && plan.mode !== "unavailable" && DESTINATION_EMOJI[plan.mode]) || "📍";

  useEffect(() => {
    if (!apiKey || !homeCoords || !plan || !containerRef.current) return;

    let cancelled = false;
    let refreshTimer: ReturnType<typeof setInterval> | undefined;
    let map: TT.Map | undefined;

    const origin = toLngLat(homeCoords);
    const destination = destinationCoords ? toLngLat(destinationCoords) : null;
    const framingDestination =
      destination ?? (fallbackFramingCoords ? toLngLat(fallbackFramingCoords) : null);

    (async () => {
      const [{ default: tt }] = await Promise.all([
        import("@tomtom-international/web-sdk-maps"),
        import("@tomtom-international/web-sdk-maps/dist/maps.css"),
      ]);

      if (cancelled || !containerRef.current) return;

      map = tt.map({
        key: apiKey,
        container: containerRef.current,
        center: origin,
        zoom: 11,
        interactive: false,
      });

      map.on("load", () => {
        new tt.Marker({ element: makeMarkerIcon("🏠", "#4ade80") })
          .setLngLat(origin)
          .addTo(map!);
        if (destination) {
          new tt.Marker({ element: makeMarkerIcon(destinationEmoji, "#ef4444") })
            .setLngLat(destination)
            .addTo(map!);
        } else {
          // No specific place to route to — fall back to the general
          // area's live traffic-flow coloring instead of a blank map.
          map!.showTrafficFlow();
          if (framingDestination) {
            const bounds = new tt.LngLatBounds(origin, origin).extend(framingDestination);
            map!.fitBounds(bounds, { padding: 30 });
          }
        }
      });

      if (!destination) return;

      const drawRoute = async () => {
        try {
          const { coords, sections } = await fetchRouteWithTraffic(
            apiKey,
            origin,
            destination,
          );
          if (cancelled || !map || !coords.length) return;

          const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: coords },
          };
          const source = map.getSource("route") as TT.GeoJSONSource | undefined;
          if (source) {
            source.setData(geojson);
          } else {
            map.addSource("route", { type: "geojson", data: geojson });
            map.addLayer({
              id: "route-line",
              type: "line",
              source: "route",
              paint: { "line-color": ROUTE_COLOR, "line-width": 5, "line-opacity": 0.9 },
            });
          }

          const severityFeatures = sections
            .filter((s) => s.sectionType?.toLowerCase() === "traffic")
            .map((s) => {
              const color = delayColor(s.magnitudeOfDelay);
              if (!color) return null;
              const feature: GeoJSON.Feature<GeoJSON.LineString, { color: string }> = {
                type: "Feature",
                properties: { color },
                geometry: {
                  type: "LineString",
                  coordinates: coords.slice(s.startPointIndex, s.endPointIndex + 1),
                },
              };
              return feature;
            })
            .filter((f): f is NonNullable<typeof f> => f !== null);
          const severityGeojson: GeoJSON.FeatureCollection = {
            type: "FeatureCollection",
            features: severityFeatures,
          };

          const severitySource = map.getSource("route-severity") as
            | TT.GeoJSONSource
            | undefined;
          if (severitySource) {
            severitySource.setData(severityGeojson);
          } else {
            map.addSource("route-severity", { type: "geojson", data: severityGeojson });
            map.addLayer({
              id: "route-severity-line",
              type: "line",
              source: "route-severity",
              paint: {
                "line-color": ["get", "color"],
                "line-width": 5,
                "line-opacity": 1,
              },
            });
          }

          const bounds = coords.reduce(
            (b, c) => b.extend(c),
            new tt.LngLatBounds(coords[0], coords[0]),
          );
          map.fitBounds(bounds, { padding: 30 });

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
  }, [apiKey, homeCoords, plan, destinationCoords, destinationEmoji, fallbackFramingCoords]);

  if (!apiKey || !homeCoords) {
    return (
      <Card title="Traffic">
        <Unavailable reason="NEXT_PUBLIC_TOMTOM_API_KEY / NEXT_PUBLIC_HOME_COORDS not configured" />
      </Card>
    );
  }

  if (!plan) {
    return (
      <Card title="Traffic">
        <Unavailable reason="loading" />
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
