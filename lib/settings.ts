import { redis } from "@/lib/kv";

const KEY = "dashboard:settings";

export type DashboardSettings = {
  defaultWakeHour: number;
  defaultWakeMinute: number;
  getReadyMinutes: number;
  personalArrivalBufferMinutes: number;
  workArrivalBufferMinutes: number;
  earlyMeetingCutoffHour: number;
  afternoonCutoffHour: number;
  sundayNoonCutoffHour: number;
  workEmailDomain: string;
  alarmRampSeconds: number;
  snoozeMinutes: number;
};

// The values every one of these already had hardcoded before this
// settings page existed — used both as the form's starting point and
// as the fallback if KV is unreachable or a value is missing.
export const DEFAULT_SETTINGS: DashboardSettings = {
  defaultWakeHour: 8,
  defaultWakeMinute: 0,
  getReadyMinutes: 40,
  personalArrivalBufferMinutes: 10,
  workArrivalBufferMinutes: 10,
  earlyMeetingCutoffHour: 9,
  afternoonCutoffHour: 13,
  sundayNoonCutoffHour: 12,
  workEmailDomain: "droplet.io",
  alarmRampSeconds: 30,
  snoozeMinutes: 10,
};

// Fails open to defaults — a KV outage or a partially-written value
// should never break the alarm/commute logic, just behave exactly as
// it did before this settings page existed.
export async function getSettings(): Promise<DashboardSettings> {
  try {
    const stored = await redis.get<Partial<DashboardSettings>>(KEY);
    return { ...DEFAULT_SETTINGS, ...stored };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function setSettings(settings: DashboardSettings): Promise<void> {
  await redis.set(KEY, settings);
}
