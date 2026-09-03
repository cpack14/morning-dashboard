import { NextResponse } from "next/server";
import { HOME_TIMEZONE } from "@/lib/workout";
import { fetchGoogleCalendarEvents } from "@/lib/googleCalendar";

export const dynamic = "force-dynamic";

const EARLY_CUTOFF_HOUR = 9;
const ARRIVAL_BUFFER_MINUTES = 10;

type TimedMeeting = { id: string; title: string; start: Date; end: Date };

function dayKeyInTimezone(date: Date) {
  return date.toLocaleDateString("en-CA", { timeZone: HOME_TIMEZONE });
}

function hourInTimezone(date: Date) {
  return Number(
    date.toLocaleString("en-US", {
      timeZone: HOME_TIMEZONE,
      hour: "numeric",
      hour12: false,
    }),
  );
}

function unavailable(reason: string) {
  return NextResponse.json({ suggestion: null, reason });
}

export async function GET() {
  const refreshToken = process.env.GOOGLE_WORK_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const tomtomKey = process.env.TOMTOM_API_KEY;
  const origin = process.env.HOME_COORDS;
  const destination = process.env.WORK_COORDS;

  if (!refreshToken || !clientId || !clientSecret) {
    return unavailable("work calendar not configured");
  }
  if (!tomtomKey || !origin || !destination) {
    return unavailable("commute not configured");
  }

  const now = new Date();
  const todayKey = dayKeyInTimezone(now);
  const timeMin = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  let raw;
  try {
    raw = await fetchGoogleCalendarEvents(refreshToken, timeMin, timeMax);
  } catch (error) {
    return unavailable((error as Error).message);
  }

  const todaysMeetings: TimedMeeting[] = raw
    .filter((item) => item.start?.dateTime && item.end?.dateTime && item.id)
    .map((item) => ({
      id: item.id!,
      title: item.summary ?? "(no title)",
      start: new Date(item.start!.dateTime!),
      end: new Date(item.end!.dateTime!),
    }))
    .filter((e) => dayKeyInTimezone(e.start) === todayKey)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  // The meeting we're actually planning the commute around: the first
  // upcoming meeting today at or after 9am. Anything earlier is assumed
  // to be attended remotely rather than commuted for.
  const anchor = todaysMeetings.find(
    (e) => hourInTimezone(e.start) >= EARLY_CUTOFF_HOUR && e.start.getTime() > now.getTime(),
  );

  if (!anchor) {
    return unavailable("no upcoming in-office meeting today");
  }

  // The meeting (if any) immediately before the anchor — commonly an
  // early sub-9am meeting taken from home. We can't leave before it ends.
  const previous = todaysMeetings
    .filter((e) => e.id !== anchor.id && e.end.getTime() <= anchor.start.getTime())
    .sort((a, b) => b.end.getTime() - a.end.getTime())[0];

  const arriveAt = new Date(
    anchor.start.getTime() - ARRIVAL_BUFFER_MINUTES * 60 * 1000,
  );

  const url = `https://api.tomtom.com/routing/1/calculateRoute/${origin}:${destination}/json?key=${tomtomKey}&arriveAt=${arriveAt.toISOString()}&computeTravelTimeFor=all`;

  let travelTimeMinutes: number;
  let predictedDepartureTime: Date;
  let trafficCondition: "light" | "average" | "heavy";
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`TomTom returned ${res.status}`);
    const data = await res.json();
    const summary = data.routes?.[0]?.summary;
    if (!summary) throw new Error("No route summary in TomTom response");
    travelTimeMinutes = Math.round(summary.travelTimeInSeconds / 60);
    predictedDepartureTime = new Date(summary.departureTime);

    const freeFlow = summary.noTrafficTravelTimeInSeconds as number;
    const predicted = summary.historicTrafficTravelTimeInSeconds as number;
    const slowdownPct = freeFlow > 0 ? ((predicted - freeFlow) / freeFlow) * 100 : 0;
    trafficCondition =
      slowdownPct >= 20 ? "heavy" : slowdownPct >= 8 ? "average" : "light";
  } catch (error) {
    return unavailable((error as Error).message);
  }

  const clamped = Boolean(
    previous && previous.end.getTime() > predictedDepartureTime.getTime(),
  );
  const leaveBy = clamped ? previous!.end : predictedDepartureTime;
  const tight =
    leaveBy.getTime() + travelTimeMinutes * 60 * 1000 > anchor.start.getTime();

  return NextResponse.json({
    suggestion: {
      meetingTitle: anchor.title,
      meetingStart: anchor.start.toISOString(),
      leaveBy: leaveBy.toISOString(),
      travelTimeMinutes,
      trafficCondition,
      clampedByPreviousMeeting: clamped,
      tight,
    },
  });
}
