"use client";

import { useEffect, useRef, useState } from "react";
import { Card, Unavailable } from "@/components/Card";
import { useFetchPoll } from "@/lib/useFetchPoll";
import { classifyTraffic } from "@/lib/trafficCondition";
import type * as TT from "@tomtom-international/web-sdk-maps";

const REFRESH_MS = 5 * 60 * 1000;
const COMMUTE_PLAN_POLL_MS = 60 * 1000;
const ROUTE_COLOR = "#5b9dff";
const MODERATE_DELAY_COLOR = "#f59e0b";
const SEVERE_DELAY_COLOR = "#ef4444";
const TYPICAL_ROUTE_COLOR = "#8b96ab";
// Below this, a live-vs-typical gap is just normal noise, not worth
// calling out.
const NOTABLE_TIME_DIFF_MINUTES = 2;

type CommutePlanResponse =
  | { mode: "work" | "personal" | "church" | "bountiful"; destinationCoords: string }
  | { mode: "unavailable"; reason: string };

const DESTINATION_EMOJI: Record<string, string> = {
  work: "💼",
  church: "⛪",
};

// Reuses the same classifier the Current Commute card's traffic label
// is built from, so a segment is never colored here in a way that
// contradicts what that label says.
function delayColor(magnitude: number | undefined): string | undefined {
  const condition = classifyTraffic([{ sectionType: "traffic", magnitudeOfDelay: magnitude }]);
  if (condition === "heavy") return SEVERE_DELAY_COLOR;
  if (condition === "moderate") return MODERATE_DELAY_COLOR;
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
    summary?: { travelTimeInSeconds: number };
  }[];
};

function routeCoords(route: TomTomRoutingResponse["routes"][number]): [number, number][] {
  return route.legs.flatMap((leg) =>
    leg.points.map((p): [number, number] => [p.longitude, p.latitude]),
  );
}

// Calls TomTom's routing REST API directly rather than going through
// @tomtom-international/web-sdk-services' calculateRoute/
// toRouteSectionsCollection helpers — that convenience method throws
// internally in the installed SDK version when traffic sections are
// requested, so we parse the raw response ourselves instead.
async function fetchRouteWithTraffic(
  apiKey: string,
  origin: [number, number],
  destination: [number, number],
): Promise<{
  coords: [number, number][];
  sections: TomTomRouteSection[];
  travelTimeMinutes: number;
}> {
  const url =
    `https://api.tomtom.com/routing/1/calculateRoute/` +
    `${origin[1]},${origin[0]}:${destination[1]},${destination[0]}/json` +
    `?key=${apiKey}&routeType=fastest&traffic=true&sectionType=traffic`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`TomTom routing request failed (${res.status})`);
  const data: TomTomRoutingResponse = await res.json();

  const route = data.routes?.[0];
  if (!route) throw new Error("No route returned");

  return {
    coords: routeCoords(route),
    sections: route.sections ?? [],
    travelTimeMinutes: Math.round((route.summary?.travelTimeInSeconds ?? 0) / 60),
  };
}

// Same route, but computed from typical/historical speeds rather than
// live traffic — this is the route you'd take on an ordinary day, and
// deliberately won't route around a live-only closure/jam the way the
// traffic-aware call above does. Drawn underneath the live route, so
// it only becomes visible when the two actually diverge.
async function fetchTypicalRoute(
  apiKey: string,
  origin: [number, number],
  destination: [number, number],
): Promise<{ coords: [number, number][]; travelTimeMinutes: number }> {
  const url =
    `https://api.tomtom.com/routing/1/calculateRoute/` +
    `${origin[1]},${origin[0]}:${destination[1]},${destination[0]}/json` +
    `?key=${apiKey}&routeType=fastest&traffic=false`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`TomTom routing request failed (${res.status})`);
  const data: TomTomRoutingResponse = await res.json();

  const route = data.routes?.[0];
  if (!route) throw new Error("No route returned");

  return {
    coords: routeCoords(route),
    travelTimeMinutes: Math.round((route.summary?.travelTimeInSeconds ?? 0) / 60),
  };
}

// TomTom's incident iconCategory codes. 6 (jam) is deliberately
// excluded — that's already conveyed by the route's own color-coding,
// so surfacing it here would just be redundant noise. Weather-only
// categories (fog/rain/ice/wind) are excluded too since they describe
// general conditions rather than a specific blockage on the route.
const NOTABLE_INCIDENT_ICON: Record<number, string> = {
  1: "🚗", // accident
  3: "⚠️", // dangerous conditions
  8: "🚫", // road closed
  9: "🚧", // road works
  11: "🌊", // flooding
  14: "🛑", // broken down vehicle
};

type NotableIncident = { description: string; icon: string; position: [number, number] | null };

type IncidentGeometry =
  | { type: "Point"; coordinates: [number, number] }
  | { type: "LineString"; coordinates: [number, number][] };

// A LineString incident (e.g. a closed stretch of road) doesn't have a
// single location — use its midpoint as a representative marker spot.
function incidentPosition(geometry: IncidentGeometry | undefined): [number, number] | null {
  if (!geometry) return null;
  if (geometry.type === "Point") return geometry.coordinates;
  if (geometry.type === "LineString" && geometry.coordinates.length > 0) {
    return geometry.coordinates[Math.floor(geometry.coordinates.length / 2)];
  }
  return null;
}

// Fetches incidents in a bounding box around the route and keeps only
// the notable, non-jam ones with a human-readable description.
async function fetchNotableIncidents(
  apiKey: string,
  coords: [number, number][],
): Promise<NotableIncident[]> {
  if (!coords.length) return [];

  const lons = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  const pad = 0.01;
  const bbox = [
    Math.min(...lons) - pad,
    Math.min(...lats) - pad,
    Math.max(...lons) + pad,
    Math.max(...lats) + pad,
  ].join(",");

  const fields = encodeURIComponent(
    "{incidents{properties{iconCategory,events{description}},geometry{type,coordinates}}}",
  );
  const url =
    `https://api.tomtom.com/traffic/services/5/incidentDetails` +
    `?key=${apiKey}&bbox=${bbox}&fields=${fields}&language=en-US`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const incidents = (data.incidents ?? []) as {
      properties?: { iconCategory?: number; events?: { description?: string }[] };
      geometry?: IncidentGeometry;
    }[];

    const seen = new Set<string>();
    const notable: NotableIncident[] = [];
    for (const inc of incidents) {
      const category = inc.properties?.iconCategory;
      const icon = category !== undefined ? NOTABLE_INCIDENT_ICON[category] : undefined;
      if (!icon) continue;

      const description = inc.properties?.events?.[0]?.description;
      if (!description) continue;

      const key = `${category}-${description}`;
      if (seen.has(key)) continue;
      seen.add(key);

      notable.push({ description, icon, position: incidentPosition(inc.geometry) });
      if (notable.length >= 3) break;
    }
    return notable;
  } catch {
    return [];
  }
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

type RouteComparison = { liveMinutes: number; typicalMinutes: number };

export function TrafficMapCard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<NotableIncident[]>([]);
  const [comparison, setComparison] = useState<RouteComparison | null>(null);

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
    let incidentMarkers: TT.Marker[] = [];

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

      if (!destination) {
        setIncidents([]);
        setComparison(null);
        return;
      }

      const drawRoute = async () => {
        try {
          const [{ coords, sections, travelTimeMinutes }, typical] = await Promise.all([
            fetchRouteWithTraffic(apiKey, origin, destination),
            // Best-effort — the live route is the important one, so a
            // failure here just means no comparison this cycle rather
            // than breaking the whole card.
            fetchTypicalRoute(apiKey, origin, destination).catch(() => null),
          ]);
          if (cancelled || !map || !coords.length) return;

          fetchNotableIncidents(apiKey, coords).then((result) => {
            if (cancelled || !map) return;
            setIncidents(result);
            incidentMarkers.forEach((m) => m.remove());
            incidentMarkers = result
              .filter((inc): inc is NotableIncident & { position: [number, number] } =>
                Boolean(inc.position),
              )
              .map((inc) =>
                new tt.Marker({ element: makeMarkerIcon(inc.icon, "#f59e0b") })
                  .setLngLat(inc.position)
                  .addTo(map!),
              );
          });

          setComparison(
            typical ? { liveMinutes: travelTimeMinutes, typicalMinutes: typical.travelTimeMinutes } : null,
          );

          // Drawn first so it sits underneath the live route below —
          // when the two routes match, the live line fully covers it
          // and it's invisible; it only becomes visible where the
          // live route (routed around live traffic/closures) actually
          // diverges from the typical historical-speed route.
          if (typical) {
            const typicalGeojson: GeoJSON.Feature<GeoJSON.LineString> = {
              type: "Feature",
              properties: {},
              geometry: { type: "LineString", coordinates: typical.coords },
            };
            const typicalSource = map.getSource("route-typical") as
              | TT.GeoJSONSource
              | undefined;
            if (typicalSource) {
              typicalSource.setData(typicalGeojson);
            } else {
              map.addSource("route-typical", { type: "geojson", data: typicalGeojson });
              map.addLayer({
                id: "route-typical-line",
                type: "line",
                source: "route-typical",
                paint: {
                  "line-color": TYPICAL_ROUTE_COLOR,
                  "line-width": 4,
                  "line-dasharray": [2, 2],
                },
              });
            }
          }

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

          const bounds = [...coords, ...(typical?.coords ?? [])].reduce(
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
      <Card title="Current Traffic">
        <Unavailable reason="NEXT_PUBLIC_TOMTOM_API_KEY / NEXT_PUBLIC_HOME_COORDS not configured" />
      </Card>
    );
  }

  if (!plan) {
    return (
      <Card title="Current Traffic">
        <Unavailable reason="loading" />
      </Card>
    );
  }

  return (
    <Card title="Current Traffic">
      <div className="flex h-full flex-col">
        {error && (
          <p className="text-label shrink-0 pb-[0.5vh] text-accent-warn">
            Route unavailable — {error}
          </p>
        )}
        {incidents.length > 0 && (
          <div className="shrink-0 pb-[0.5vh]">
            {incidents.map((inc, i) => (
              <p key={i} className="text-label text-accent-warn">
                {inc.icon} {inc.description}
              </p>
            ))}
          </div>
        )}
        {comparison &&
          Math.abs(comparison.liveMinutes - comparison.typicalMinutes) >=
            NOTABLE_TIME_DIFF_MINUTES && (
            <p className="text-label shrink-0 pb-[0.5vh] text-accent-warn">
              🛣️ {comparison.liveMinutes} min now vs. usually {comparison.typicalMinutes} min (
              {comparison.liveMinutes > comparison.typicalMinutes ? "+" : ""}
              {comparison.liveMinutes - comparison.typicalMinutes} min)
            </p>
          )}
        <div ref={containerRef} className="min-h-0 w-full flex-1" />
      </div>
    </Card>
  );
}
