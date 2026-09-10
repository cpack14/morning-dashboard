import { HOME_TIMEZONE } from "@/lib/workout";

export function dayKeyInTimezone(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: HOME_TIMEZONE });
}

export function hourInTimezone(date: Date): number {
  return Number(
    date.toLocaleString("en-US", {
      timeZone: HOME_TIMEZONE,
      hour: "numeric",
      hour12: false,
    }),
  );
}

function weekdayInTimezone(date: Date): string {
  return date.toLocaleDateString("en-US", {
    timeZone: HOME_TIMEZONE,
    weekday: "short",
  });
}

export function isWeekend(date: Date): boolean {
  const day = weekdayInTimezone(date);
  return day === "Sat" || day === "Sun";
}

export function isSunday(date: Date): boolean {
  return weekdayInTimezone(date) === "Sun";
}

// Converts a wall-clock time in the given IANA timezone to the correct
// UTC instant, accounting for DST.
export function zonedTimeToUtc(
  dateKey: string,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  // Treat the target wall-clock time as if it were UTC — wrong, but a
  // reasonable starting point for finding the zone's offset near it.
  const naiveUtc = new Date(
    `${dateKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`,
  );

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(naiveUtc);
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  const hh = get("hour") === "24" ? "00" : get("hour");

  // What naiveUtc's instant actually reads as in the target zone,
  // itself misread as UTC — the gap between this and naiveUtc is
  // exactly the zone's offset at that instant.
  const shownAsUtc = new Date(
    `${get("year")}-${get("month")}-${get("day")}T${hh}:${get("minute")}:${get("second")}Z`,
  );
  const offset = shownAsUtc.getTime() - naiveUtc.getTime();

  return new Date(naiveUtc.getTime() - offset);
}
