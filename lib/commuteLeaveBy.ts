const ARRIVAL_BUFFER_MINUTES = 10;

export type LeaveByResult = {
  leaveBy: Date;
  travelTimeMinutes: number;
  trafficCondition: "light" | "average" | "heavy";
};

// Asks TomTom what time to leave home to arrive at work by 10 minutes
// before the given meeting start, using predicted (not live) traffic
// for that future time of day.
export async function computeLeaveBy(meetingStart: Date): Promise<LeaveByResult> {
  const tomtomKey = process.env.TOMTOM_API_KEY;
  const origin = process.env.HOME_COORDS;
  const destination = process.env.WORK_COORDS;
  if (!tomtomKey || !origin || !destination) {
    throw new Error("commute not configured");
  }

  const arriveAt = new Date(
    meetingStart.getTime() - ARRIVAL_BUFFER_MINUTES * 60 * 1000,
  );
  const url = `https://api.tomtom.com/routing/1/calculateRoute/${origin}:${destination}/json?key=${tomtomKey}&arriveAt=${arriveAt.toISOString()}&computeTravelTimeFor=all`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`TomTom returned ${res.status}`);
  const data = await res.json();
  const summary = data.routes?.[0]?.summary;
  if (!summary) throw new Error("No route summary in TomTom response");

  const travelTimeMinutes = Math.round(summary.travelTimeInSeconds / 60);
  const leaveBy = new Date(summary.departureTime);

  const freeFlow = summary.noTrafficTravelTimeInSeconds as number;
  const predicted = summary.historicTrafficTravelTimeInSeconds as number;
  const slowdownPct = freeFlow > 0 ? ((predicted - freeFlow) / freeFlow) * 100 : 0;
  const trafficCondition =
    slowdownPct >= 20 ? "heavy" : slowdownPct >= 8 ? "average" : "light";

  return { leaveBy, travelTimeMinutes, trafficCondition };
}
