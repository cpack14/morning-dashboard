export type TrafficCondition = "light" | "moderate" | "heavy";

// Categorizes how much slower a route is than its free-flow (no
// traffic) time. Shared by the live "current commute" ETA and the
// predicted (historic-traffic) leave-by calculation, so both use the
// same thresholds.
export function classifyTraffic(
  delayMinutes: number,
  freeFlowMinutes: number,
): TrafficCondition {
  const slowdownPct = freeFlowMinutes > 0 ? (delayMinutes / freeFlowMinutes) * 100 : 0;
  if (slowdownPct >= 20) return "heavy";
  if (slowdownPct >= 8) return "moderate";
  return "light";
}
