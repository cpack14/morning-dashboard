import { redis } from "@/lib/kv";

const KEY = "alarm:custom";

// A one-time manual override for a single calendar day, set the night
// before from the settings page. `date` is the home-timezone day key
// (YYYY-MM-DD) it applies to — once that day is no longer "today" or
// "tomorrow", the wake-time route simply stops matching it, so it
// expires on its own without needing to be explicitly cleared.
export type CustomAlarm = {
  date: string;
  hour: number;
  minute: number;
};

export async function getCustomAlarm(): Promise<CustomAlarm | null> {
  try {
    return (await redis.get<CustomAlarm>(KEY)) ?? null;
  } catch {
    return null;
  }
}

export async function setCustomAlarm(alarm: CustomAlarm | null): Promise<void> {
  if (alarm === null) {
    await redis.del(KEY);
  } else {
    await redis.set(KEY, alarm);
  }
}
