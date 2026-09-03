export type TrafficCondition = "light" | "moderate" | "heavy";

type TrafficSection = { sectionType: string; magnitudeOfDelay?: number };

// TomTom's traffic sections report a 0-4 magnitude: 0 unknown, 1 minor,
// 2 moderate, 3 major, 4 undefined (usually a closure). Classifies a
// route by its single worst flagged section — the same signal used to
// color individual segments amber/red on the traffic map, so this text
// label can never contradict what the map is actually showing. (An
// overall percentage-slowdown-vs-free-flow metric was tried first, but
// routinely read "moderate" on completely clear routes — ordinary stop
// signs and speed limits alone cause an 8-15% "slowdown" from a
// theoretical ideal, with zero real congestion involved.)
export function classifyTraffic(sections: TrafficSection[]): TrafficCondition {
  const maxMagnitude = sections
    .filter((s) => s.sectionType?.toLowerCase() === "traffic")
    .reduce((max, s) => Math.max(max, s.magnitudeOfDelay ?? 0), 0);

  if (maxMagnitude >= 3) return "heavy";
  if (maxMagnitude >= 2) return "moderate";
  return "light";
}
