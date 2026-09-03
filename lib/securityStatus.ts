import { redis } from "@/lib/kv";

const KEY = "security:status";

export type SecurityStatus = "away" | "home";

// Fails open to "home" — a KV outage or unset value should never
// silently disable the alarm/TV, only an explicit "away" should.
export async function getSecurityStatus(): Promise<SecurityStatus> {
  try {
    const value = await redis.get<string>(KEY);
    return value === "away" ? "away" : "home";
  } catch {
    return "home";
  }
}

export async function setSecurityStatus(state: SecurityStatus): Promise<void> {
  await redis.set(KEY, state);
}
