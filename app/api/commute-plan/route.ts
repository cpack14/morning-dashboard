import { NextResponse } from "next/server";
import { HOME_TIMEZONE } from "@/lib/workout";
import { fetchGoogleCalendarEvents } from "@/lib/googleCalendar";
import { computeLeaveBy } from "@/lib/commuteLeaveBy";

export const dynamic = "force-dynamic";

const EARLY_CUTOFF_HOUR = 9;

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

  let travelTimeMinutes: number;
  let predictedDepartureTime: Date;
  let trafficCondition: "light" | "average" | "heavy";
  try {
    const result = await computeLeaveBy(anchor.start);
    travelTimeMinutes = result.travelTimeMinutes;
    predictedDepartureTime = result.leaveBy;
    trafficCondition = result.trafficCondition;
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
