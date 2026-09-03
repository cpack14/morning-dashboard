import { classifyTraffic, type TrafficCondition } from "@/lib/trafficCondition";

const ARRIVAL_BUFFER_MINUTES = 10;

export type LeaveByResult = {
  leaveBy: Date;
  travelTimeMinutes: number;
  distanceMiles: number;
  trafficCondition: TrafficCondition;
};

// Asks TomTom what time to leave home to arrive at the given
// destination by 10 minutes before the target start time, using
// predicted (not live) traffic for that future time of day.
export async function computeLeaveBy(
  targetStart: Date,
  destinationCoords: string,
): Promise<LeaveByResult> {
  const tomtomKey = process.env.TOMTOM_API_KEY;
  const origin = process.env.HOME_COORDS;
  if (!tomtomKey || !origin || !destinationCoords) {
    throw new Error("commute not configured");
  }

  const arriveAt = new Date(
    targetStart.getTime() - ARRIVAL_BUFFER_MINUTES * 60 * 1000,
  );
  const url = `https://api.tomtom.com/routing/1/calculateRoute/${origin}:${destinationCoords}/json?key=${tomtomKey}&arriveAt=${arriveAt.toISOString()}&computeTravelTimeFor=all&sectionType=traffic`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`TomTom returned ${res.status}`);
  const data = await res.json();
  const summary = data.routes?.[0]?.summary;
  if (!summary) throw new Error("No route summary in TomTom response");

  const travelTimeMinutes = Math.round(summary.travelTimeInSeconds / 60);
  const distanceMiles = Math.round((summary.lengthInMeters / 1609.34) * 10) / 10;
  const leaveBy = new Date(summary.departureTime);
  const trafficCondition = classifyTraffic(data.routes?.[0]?.sections ?? []);

  return { leaveBy, travelTimeMinutes, distanceMiles, trafficCondition };
}
