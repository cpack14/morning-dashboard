import { NextResponse } from "next/server";
import { fetchGoogleCalendarEvents, type RawCalendarEvent } from "@/lib/googleCalendar";
import { dayKeyInTimezone, isWeekend } from "@/lib/timezone";

export const dynamic = "force-dynamic";

const WORK_DOMAIN = "droplet.io";
const OOO_DAYS_AHEAD = 365;

type DaySummaryResponse =
  | { unavailable: true; reason: string }
  | {
      dayType: "holiday" | "weekend" | "weekday";
      holidayName?: string;
      meetings?: { client: number; internal: number };
      personalEventCount?: number;
      outOfOffice: { title: string; daysUntil: number } | null;
      birthdays: string[];
      nextTravel: { title: string; daysUntil: number } | null;
    };

type NagerHoliday = { date: string; name: string; global: boolean };

// Nager.Date's public-holiday list doesn't include these (they're
// observances, not public holidays), but they're fixed calendar dates
// every year, so just check them directly rather than calling out.
const FIXED_HOLIDAYS: Record<string, string> = {
  "12-24": "Christmas Eve",
  "12-31": "New Year's Eve",
};

// Best-effort — a holiday miss just means a normal greeting instead of
// a "Happy X" one, not a broken header.
async function fetchHolidayName(now: Date): Promise<string | null> {
  const todayKey = dayKeyInTimezone(now);
  const fixed = FIXED_HOLIDAYS[todayKey.slice(5)];
  if (fixed) return fixed;

  try {
    const year = now.getFullYear();
    const res = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/US`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const holidays: NagerHoliday[] = await res.json();
    // `global` filters out state-specific/optional observances (e.g.
    // "Truman Day") so only nationally-recognized holidays trigger it.
    const match = holidays.find((h) => h.date === todayKey && h.global);
    return match?.name ?? null;
  } catch {
    return null;
  }
}

function classifyWorkMeetings(raw: RawCalendarEvent[], todayKey: string) {
  let client = 0;
  let internal = 0;

  for (const item of raw) {
    // All-day blocks (e.g. "Company Holiday") aren't meetings.
    const startRaw = item.start?.dateTime;
    if (!startRaw || dayKeyInTimezone(new Date(startRaw)) !== todayKey) continue;

    const me = item.attendees?.find((a) => a.self);
    if (me?.responseStatus === "declined") continue;

    const others = (item.attendees ?? []).filter((a) => !a.self && !a.resource);
    if (others.length === 0) continue; // solo block, not a meeting with anyone

    const hasExternal = others.some(
      (a) => !a.email?.toLowerCase().endsWith(`@${WORK_DOMAIN}`),
    );
    if (hasExternal) client++;
    else internal++;
  }

  return { client, internal };
}

function countPersonalEventsToday(raw: RawCalendarEvent[], todayKey: string): number {
  let count = 0;
  for (const item of raw) {
    const startRaw = item.start?.dateTime ?? item.start?.date;
    const endRaw = item.end?.dateTime ?? item.end?.date;
    if (!startRaw || !endRaw) continue;

    const allDay = Boolean(item.start?.date && !item.start?.dateTime);
    const isToday = allDay
      ? startRaw <= todayKey && todayKey < endRaw
      : dayKeyInTimezone(new Date(startRaw)) === todayKey;

    if (isToday) count++;
  }
  return count;
}

// Pulls a name out of titles like "John's Birthday", "Sarah Birthday",
// or "Mom's bday" — falls back to null (rather than the raw title) so
// a title with no clean name doesn't produce a nonsense sentence.
function extractBirthdayName(title: string): string | null {
  const match = title.trim().match(/^(.+?)(?:['’]s)?\s+(?:birthday|bday)\b/i);
  const name = match?.[1]?.trim();
  return name ? name : null;
}

function findBirthdaysToday(raw: RawCalendarEvent[], todayKey: string): string[] {
  const names: string[] = [];

  for (const item of raw) {
    const title = item.summary ?? "";
    if (!/\b(birthday|bday)\b/i.test(title)) continue;

    const startRaw = item.start?.date ?? item.start?.dateTime;
    const endRaw = item.end?.date ?? item.end?.dateTime;
    if (!startRaw || !endRaw) continue;

    const allDay = Boolean(item.start?.date && !item.start?.dateTime);
    const isToday = allDay
      ? startRaw <= todayKey && todayKey < endRaw
      : dayKeyInTimezone(new Date(startRaw)) === todayKey;
    if (!isToday) continue;

    names.push(extractBirthdayName(title) ?? title.trim());
  }

  return names;
}

// Local-noon anchors on both sides cancel out any DST offset, so this
// is a clean whole-day difference regardless of the time of day "now"
// actually is.
function daysBetweenKeys(fromKey: string, toKey: string): number {
  const from = new Date(`${fromKey}T12:00:00`);
  const to = new Date(`${toKey}T12:00:00`);
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function findNextOutOfOffice(
  rawLists: RawCalendarEvent[][],
  todayKey: string,
): { title: string; daysUntil: number } | null {
  let best: { title: string; startKey: string } | null = null;

  for (const raw of rawLists) {
    for (const item of raw) {
      const startRaw = item.start?.dateTime ?? item.start?.date;
      if (!startRaw) continue;
      const startKey = dayKeyInTimezone(new Date(startRaw));
      if (startKey < todayKey) continue;
      if (!best || startKey < best.startKey) {
        best = { title: item.summary ?? "Out of Office", startKey };
      }
    }
  }

  if (!best) return null;
  return { title: best.title, daysUntil: daysBetweenKeys(todayKey, best.startKey) };
}

// Three independent signals, any one of which counts as "looks like a
// flight": the word itself, an airline-code-style pattern (e.g. "UA
// 1234"), or Google's own flag for events Gmail auto-created from a
// confirmation email (which also covers hotels/rentals/tickets, so it
// isn't perfectly precise on its own — combined with the other two
// signals as a permissive OR, per explicit choice to include all three
// even knowing that trade-off).
const FLIGHT_KEYWORD = /\bflight\b/i;
const AIRLINE_CODE_PATTERN = /\b[A-Z]{2}\s?\d{2,4}\b/;
const ONSITE_KEYWORD = /\bonsite\b/i;

function looksLikeFlight(item: RawCalendarEvent): boolean {
  const title = item.summary ?? "";
  return (
    FLIGHT_KEYWORD.test(title) ||
    AIRLINE_CODE_PATTERN.test(title) ||
    item.eventType === "fromGmail"
  );
}

function isMultiDayOnsite(item: RawCalendarEvent): boolean {
  if (!ONSITE_KEYWORD.test(item.summary ?? "")) return false;

  const startRaw = item.start?.dateTime ?? item.start?.date;
  const endRaw = item.end?.dateTime ?? item.end?.date;
  if (!startRaw || !endRaw) return false;

  return dayKeyInTimezone(new Date(startRaw)) !== dayKeyInTimezone(new Date(endRaw));
}

function findNextTravelEvent(
  workRaw: RawCalendarEvent[],
  personalRaw: RawCalendarEvent[],
  todayKey: string,
): { title: string; daysUntil: number } | null {
  const candidates: RawCalendarEvent[] = [
    ...[...workRaw, ...personalRaw].filter(looksLikeFlight),
    // Onsite is work-only, per the rule as specified.
    ...workRaw.filter(isMultiDayOnsite),
  ];

  let best: { title: string; startKey: string } | null = null;
  for (const item of candidates) {
    const startRaw = item.start?.dateTime ?? item.start?.date;
    if (!startRaw) continue;
    const startKey = dayKeyInTimezone(new Date(startRaw));
    if (startKey < todayKey) continue;
    if (!best || startKey < best.startKey) {
      best = { title: item.summary ?? "Flight", startKey };
    }
  }

  if (!best) return null;
  return { title: best.title, daysUntil: daysBetweenKeys(todayKey, best.startKey) };
}

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const workToken = process.env.GOOGLE_WORK_REFRESH_TOKEN;
  const personalToken = process.env.GOOGLE_PERSONAL_REFRESH_TOKEN;

  if (!clientId || !clientSecret) {
    return NextResponse.json({
      unavailable: true,
      reason: "Google Calendar not configured",
    });
  }

  const now = new Date();
  const todayKey = dayKeyInTimezone(now);
  const dayWindowMin = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const dayWindowMax = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const oooWindowMax = new Date(
    now.getTime() + OOO_DAYS_AHEAD * 24 * 60 * 60 * 1000,
  ).toISOString();

  try {
    const oooLists = await Promise.all(
      [workToken, personalToken]
        .filter((t): t is string => Boolean(t))
        .map((token) =>
          fetchGoogleCalendarEvents(
            token,
            now.toISOString(),
            oooWindowMax,
            50,
            ["outOfOffice"],
          ),
        ),
    );
    const outOfOffice = findNextOutOfOffice(oooLists, todayKey);

    // Separate from the OOO fetch since it needs actual (non-outOfOffice)
    // events to scan for flight/onsite signals — "default" covers
    // normal events (including a manually-typed "Onsite" or "Flight to
    // X"), "fromGmail" covers Gmail's own auto-detected confirmations.
    const [workTravelRaw, personalTravelRaw] = await Promise.all([
      workToken
        ? fetchGoogleCalendarEvents(workToken, now.toISOString(), oooWindowMax, 50, [
            "default",
            "fromGmail",
          ])
        : Promise.resolve([]),
      personalToken
        ? fetchGoogleCalendarEvents(personalToken, now.toISOString(), oooWindowMax, 50, [
            "default",
            "fromGmail",
          ])
        : Promise.resolve([]),
    ]);
    const nextTravel = findNextTravelEvent(workTravelRaw, personalTravelRaw, todayKey);

    // Fetched unconditionally (not just on weekends) since birthdays
    // are checked every day, regardless of day type.
    const personalRawToday = personalToken
      ? await fetchGoogleCalendarEvents(personalToken, dayWindowMin, dayWindowMax, 50)
      : [];
    const birthdays = findBirthdaysToday(personalRawToday, todayKey);

    const holidayName = await fetchHolidayName(now);
    if (holidayName) {
      const body: DaySummaryResponse = {
        dayType: "holiday",
        holidayName,
        outOfOffice,
        birthdays,
        nextTravel,
      };
      return NextResponse.json(body);
    }

    if (isWeekend(now)) {
      const personalEventCount = countPersonalEventsToday(personalRawToday, todayKey);
      const body: DaySummaryResponse = {
        dayType: "weekend",
        personalEventCount,
        outOfOffice,
        birthdays,
        nextTravel,
      };
      return NextResponse.json(body);
    }

    const meetings = workToken
      ? classifyWorkMeetings(
          await fetchGoogleCalendarEvents(workToken, dayWindowMin, dayWindowMax, 50),
          todayKey,
        )
      : { client: 0, internal: 0 };
    const body: DaySummaryResponse = {
      dayType: "weekday",
      meetings,
      outOfOffice,
      birthdays,
      nextTravel,
    };
    return NextResponse.json(body);
  } catch (error) {
    const body: DaySummaryResponse = {
      unavailable: true,
      reason: (error as Error).message,
    };
    return NextResponse.json(body);
  }
}
