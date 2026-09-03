import { NextResponse } from "next/server";
import { HOME_TIMEZONE } from "@/lib/workout";
import { fetchGoogleCalendarEvents } from "@/lib/googleCalendar";

export const dynamic = "force-dynamic";

type CalendarKey = "work" | "personal";

type DashboardEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  calendar: CalendarKey;
  day: "today" | "tomorrow";
};

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
      const raw = await fetchGoogleCalendarEvents(token, timeMin, timeMax);
      for (const item of raw) {
        const startRaw = item.start?.dateTime ?? item.start?.date;
        const endRaw = item.end?.dateTime ?? item.end?.date;
        if (!startRaw || !endRaw || !item.id) continue;

        const allDay = Boolean(item.start?.date && !item.start?.dateTime);

        const pushEvent = (day: "today" | "tomorrow") => {
          events.push({
            id: item.id!,
            title: item.summary ?? "(no title)",
            start: startRaw,
            end: endRaw,
            allDay,
            calendar: key,
            day,
          });
        };

        if (allDay) {
          // Multi-day all-day events: end date is exclusive (Google's
          // convention), so check whether today/tomorrow fall anywhere
          // in [start, end) rather than only matching the start date.
          if (startRaw <= todayKey && todayKey < endRaw) pushEvent("today");
          if (startRaw <= tomorrowKey && tomorrowKey < endRaw) pushEvent("tomorrow");
        } else {
          const dayKey = dayKeyInTimezone(new Date(startRaw));
          if (dayKey === todayKey) pushEvent("today");
          else if (dayKey === tomorrowKey) pushEvent("tomorrow");
        }
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
