const SCHEDULE = {
  Sunday: "Rest",
  Monday: "Chest",
  Tuesday: "Back / Pull",
  Wednesday: "Legs / Core",
  Thursday: "Chest",
  Friday: "Back / Pull",
  Saturday: "Legs / Core",
} as const;

export const HOME_TIMEZONE = process.env.HOME_TIMEZONE || "America/Denver";

export function todaysWorkout(date = new Date()): string {
  const weekday = date.toLocaleDateString("en-US", {
    timeZone: HOME_TIMEZONE,
    weekday: "long",
  }) as keyof typeof SCHEDULE;

  return SCHEDULE[weekday] ?? "Rest";
}
