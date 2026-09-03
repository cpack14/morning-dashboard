import { classifyTraffic, type TrafficCondition } from "@/lib/trafficCondition";

export type CurrentEta = {
  durationInTrafficMinutes: number;
  durationNoTrafficMinutes: number;
  distanceMiles: number;
  trafficDelayMinutes: number;
  trafficCondition: TrafficCondition;
};

// Live (current-traffic) ETA between two "lat,lon" points.
export async function getCurrentEta(
  origin: string,
  destination: string,
): Promise<CurrentEta> {
  const apiKey = process.env.TOMTOM_API_KEY;
  if (!apiKey) throw new Error("TOMTOM_API_KEY not configured");

  const url = `https://api.tomtom.com/routing/1/calculateRoute/${origin}:${destination}/json?key=${apiKey}&traffic=true&travelMode=car`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`TomTom returned ${res.status}`);
  const data = await res.json();
  const summary = data.routes?.[0]?.summary;
  if (!summary) throw new Error("No route summary in TomTom response");

  const durationNoTrafficMinutes = Math.round(
    (summary.travelTimeInSeconds - summary.trafficDelayInSeconds) / 60,
  );
  const trafficDelayMinutes = Math.round(summary.trafficDelayInSeconds / 60);

  return {
    durationInTrafficMinutes: Math.round(summary.travelTimeInSeconds / 60),
    durationNoTrafficMinutes,
    distanceMiles: Math.round((summary.lengthInMeters / 1609.34) * 10) / 10,
    trafficDelayMinutes,
    trafficCondition: classifyTraffic(trafficDelayMinutes, durationNoTrafficMinutes),
  };
}
