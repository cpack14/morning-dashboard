"use client";

import { useFetchPoll } from "@/lib/useFetchPoll";

const NAME = "Colton";
const POLL_MS = 10 * 60 * 1000;

type DaySummaryResponse =
  | { unavailable: true; reason: string }
  | {
      dayType: "holiday" | "weekend" | "weekday";
      holidayName?: string;
      meetings?: { client: number; internal: number };
      personalEventCount?: number;
      outOfOffice: { title: string; daysUntil: number } | null;
      birthdays: string[];
    };

type SecurityStatusResponse = { state: "home" | "away" };

// Nager.Date's official names read awkwardly as a greeting verbatim
// (double "Day", British "Labour", "Happy Christmas" instead of
// "Merry") — override the handful where that shows.
const HOLIDAY_GREETING_OVERRIDES: Record<string, string> = {
  "New Year's Day": "Happy New Year!",
  "Martin Luther King, Jr. Day": "Happy Martin Luther King Jr. Day!",
  "Juneteenth National Independence Day": "Happy Juneteenth!",
  "Labour Day": "Happy Labor Day!",
  "Thanksgiving Day": "Happy Thanksgiving!",
  "Christmas Day": "Merry Christmas!",
  "Christmas Eve": "Merry Christmas Eve!",
  "New Year's Eve": "Happy New Year's Eve!",
};

function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function describeDay(data: Extract<DaySummaryResponse, { dayType: string }>): string {
  const greeting = timeOfDayGreeting();

  if (data.dayType === "holiday") {
    const holidayLine = data.holidayName
      ? (HOLIDAY_GREETING_OVERRIDES[data.holidayName] ?? `Happy ${data.holidayName}!`)
      : "Happy Holidays!";
    return `${greeting} ${NAME}, ${holidayLine}`;
  }

  if (data.dayType === "weekend") {
    const n = data.personalEventCount ?? 0;
    if (n === 0) return `${greeting} ${NAME}, no events today`;
    return `${greeting} ${NAME}, you have ${n} event${n === 1 ? "" : "s"} today`;
  }

  const { client = 0, internal = 0 } = data.meetings ?? {};
  const total = client + internal;
  if (total === 0) return `${greeting} ${NAME}, no meetings today`;
  return `${greeting} ${NAME}, you have ${client} client and ${internal} internal meeting${total === 1 ? "" : "s"} today`;
}

function describeOutOfOffice(ooo: { title: string; daysUntil: number }): string {
  if (ooo.daysUntil === 0) return `Out of office today — ${ooo.title}`;
  if (ooo.daysUntil === 1) return `1 day until Out of Office — ${ooo.title}`;
  return `${ooo.daysUntil} days until Out of Office — ${ooo.title}`;
}

function joinNames(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function HeaderStatus() {
  const { data } = useFetchPoll<DaySummaryResponse>("/api/day-summary", POLL_MS);
  const { data: security } = useFetchPoll<SecurityStatusResponse>(
    "/api/security-status",
    POLL_MS,
  );

  if (!data || "unavailable" in data) return null;

  return (
    <div className="text-right">
      <div className="flex items-center justify-end gap-[1vh]">
        {security?.state === "away" && (
          <span className="text-label shrink-0 rounded-full border border-accent-warn px-[1vh] py-[0.2vh] text-accent-warn">
            🏠 Away
          </span>
        )}
        <p className="text-hero-sub text-muted">{describeDay(data)}</p>
      </div>
      {data.birthdays.length > 0 && (
        <p className="text-label mt-[0.3vh] text-muted">
          🎂 Don&apos;t forget to wish {joinNames(data.birthdays)} a happy birthday!
        </p>
      )}
      {data.outOfOffice && (
        <p className="text-label mt-[0.3vh] text-muted">
          🗓️ {describeOutOfOffice(data.outOfOffice)}
        </p>
      )}
    </div>
  );
}
