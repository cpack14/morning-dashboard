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
    };

type SecurityStatusResponse = { state: "home" | "away" };

function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function describeDay(data: Extract<DaySummaryResponse, { dayType: string }>): string {
  const greeting = timeOfDayGreeting();

  if (data.dayType === "holiday") {
    return `${greeting} ${NAME}, Happy ${data.holidayName}!`;
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
      {data.outOfOffice && (
        <p className="text-label mt-[0.3vh] text-muted">
          🗓️ {describeOutOfOffice(data.outOfOffice)}
        </p>
      )}
    </div>
  );
}
