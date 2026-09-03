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
