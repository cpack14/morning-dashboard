import { NextResponse } from "next/server";
import { HOME_TIMEZONE } from "@/lib/workout";

export const dynamic = "force-dynamic";

type CalendarKey = "work" | "personal";

type RawEvent = {
  id: string;
  summary?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};

type DashboardEvent = {
  id: string;
  title: string;
  start: string;
  allDay: boolean;
  calendar: CalendarKey;
  day: "today" | "tomorrow";
};

async function getAccessToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed (${res.status})`);
  }

  const data = await res.json();
  return data.access_token as string;
}

async function fetchEvents(
  calendar: CalendarKey,
  refreshToken: string,
  timeMin: string,
  timeMax: string,
): Promise<RawEvent[]> {
  const accessToken = await getAccessToken(refreshToken);

  const url = new URL(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
  );
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "20");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Calendar list failed (${res.status})`);
  }

  const data = await res.json();
  return data.items ?? [];
}

function dayKeyInTimezone(date: Date) {
  return date.toLocaleDateString("en-CA", { timeZone: HOME_TIMEZONE });
}

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshTokens: Partial<Record<CalendarKey, string>> = {
    work: process.env.GOOGLE_WORK_REFRESH_TOKEN,
    personal: process.env.GOOGLE_PERSONAL_REFRESH_TOKEN,
  };

  const now = new Date();
  const timeMin = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
  const todayKey = dayKeyInTimezone(now);
  const tomorrowKey = dayKeyInTimezone(
    new Date(now.getTime() + 24 * 60 * 60 * 1000),
  );

  const events: DashboardEvent[] = [];
  const errors: Partial<Record<CalendarKey, string>> = {};
  const configured: Partial<Record<CalendarKey, boolean>> = {};

  if (!clientId || !clientSecret) {
    return NextResponse.json({
      accounts: { work: false, personal: false },
      events: [],
      errors: {
        general: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured",
      },
    });
  }

  for (const key of Object.keys(refreshTokens) as CalendarKey[]) {
    const token = refreshTokens[key];
    configured[key] = Boolean(token);
    if (!token) continue;

    try {
      const raw = await fetchEvents(key, token, timeMin, timeMax);
      for (const item of raw) {
        const startRaw = item.start?.dateTime ?? item.start?.date;
        if (!startRaw || !item.id) continue;

        const allDay = Boolean(item.start?.date && !item.start?.dateTime);
        const dayKey = allDay
          ? startRaw
          : dayKeyInTimezone(new Date(startRaw));

        if (dayKey !== todayKey && dayKey !== tomorrowKey) continue;

        events.push({
          id: item.id,
          title: item.summary ?? "(no title)",
          start: startRaw,
          allDay,
          calendar: key,
          day: dayKey === todayKey ? "today" : "tomorrow",
        });
      }
    } catch (error) {
      errors[key] = (error as Error).message;
    }
  }

  events.sort((a, b) => {
    if (a.day !== b.day) return a.day === "today" ? -1 : 1;
    return a.start.localeCompare(b.start);
  });

  return NextResponse.json({ accounts: configured, events, errors });
}
