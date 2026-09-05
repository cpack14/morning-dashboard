import { NextResponse } from "next/server";
import { dayKeyInTimezone, hourInTimezone, isSunday, isWeekend } from "@/lib/timezone";
import { fetchGoogleCalendarEvents } from "@/lib/googleCalendar";
import { computeLeaveBy } from "@/lib/commuteLeaveBy";
import { getCurrentEta } from "@/lib/currentEta";
import { geocodeAddress } from "@/lib/tomtomGeocode";
import type { TrafficCondition } from "@/lib/trafficCondition";
import { getSettings, type DashboardSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

type Hero = {
  durationMinutes: number;
  distanceMiles: number;
  trafficDelayMinutes?: number;
  // Only present for live hero numbers (work/church/bountiful) — the
  // personal-event hero is itself a future prediction, whose condition
  // is already shown on the leaveBy line instead.
  trafficCondition?: TrafficCondition;
  live: boolean;
};

type LeaveBy = {
  time: string;
  travelTimeMinutes: number;
  eventTitle: string;
  eventStart: string;
  trafficCondition: TrafficCondition;
  tight: boolean;
};

type CommutePlanResponse =
  | {
      mode: "work" | "personal" | "church" | "bountiful";
      destinationLabel: string;
      destinationCoords: string;
      hero: Hero;
      leaveBy?: LeaveBy;
    }
  | { mode: "unavailable"; reason: string };

function unavailable(reason: string) {
  return NextResponse.json<CommutePlanResponse>({ mode: "unavailable", reason });
}

// ---- Weekday before 1pm: always show the live commute to work,
// regardless of calendar state. If there's a qualifying upcoming work
// meeting today, a "leave by" suggestion is added on top — but its
// absence (no meeting, calendar unavailable, etc.) never blanks out
// the hero number itself. ----
async function planWorkMeeting(now: Date, settings: DashboardSettings) {
  const tomtomKey = process.env.TOMTOM_API_KEY;
  const origin = process.env.HOME_COORDS;
  const destination = process.env.WORK_COORDS;

  if (!tomtomKey || !origin || !destination) {
    return unavailable("commute not configured");
  }

  let hero: Hero;
  try {
    const eta = await getCurrentEta(origin, destination);
    hero = {
      durationMinutes: eta.durationInTrafficMinutes,
      distanceMiles: eta.distanceMiles,
      trafficDelayMinutes: eta.trafficDelayMinutes,
      trafficCondition: eta.trafficCondition,
      live: true,
    };
  } catch (error) {
    return unavailable((error as Error).message);
  }

  const leaveBy = await tryComputeWorkLeaveBy(now, destination, settings);

  return NextResponse.json<CommutePlanResponse>({
    mode: "work",
    destinationLabel: "Work",
    destinationCoords: destination,
    hero,
    leaveBy,
  });
}

// Best-effort "leave by" suggestion for today's next in-office meeting.
// Returns undefined on any failure or if there's nothing to plan around
// — the caller still has the live commute number to fall back on.
async function tryComputeWorkLeaveBy(
  now: Date,
  destination: string,
  settings: DashboardSettings,
): Promise<LeaveBy | undefined> {
  const refreshToken = process.env.GOOGLE_WORK_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!refreshToken || !clientId || !clientSecret) return undefined;

  try {
    const todayKey = dayKeyInTimezone(now);
    const timeMin = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const timeMax = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const raw = await fetchGoogleCalendarEvents(refreshToken, timeMin, timeMax);
    const todaysMeetings = raw
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
    // upcoming meeting today at or after 9am. Anything earlier is
    // assumed to be attended remotely rather than commuted for.
    const anchor = todaysMeetings.find(
      (e) =>
        hourInTimezone(e.start) >= settings.earlyMeetingCutoffHour &&
        e.start.getTime() > now.getTime(),
    );
    if (!anchor) return undefined;

    // The meeting (if any) immediately before the anchor — commonly an
    // early sub-9am meeting taken from home. We can't leave before it ends.
    const previous = todaysMeetings
      .filter((e) => e.id !== anchor.id && e.end.getTime() <= anchor.start.getTime())
      .sort((a, b) => b.end.getTime() - a.end.getTime())[0];

    const leaveByResult = await computeLeaveBy(
      anchor.start,
      destination,
      settings.workArrivalBufferMinutes,
    );
    const clamped = Boolean(
      previous && previous.end.getTime() > leaveByResult.leaveBy.getTime(),
    );
    const leaveByTime = clamped ? previous!.end : leaveByResult.leaveBy;
    const tight =
      leaveByTime.getTime() + leaveByResult.travelTimeMinutes * 60 * 1000 >
      anchor.start.getTime();

    return {
      time: leaveByTime.toISOString(),
      travelTimeMinutes: leaveByResult.travelTimeMinutes,
      eventTitle: anchor.title,
      eventStart: anchor.start.toISOString(),
      trafficCondition: leaveByResult.trafficCondition,
      tight,
    };
  } catch {
    return undefined;
  }
}

// ---- Weekday after 1pm, and Saturday: next personal-calendar event
// today that has a location. ----
async function planPersonalEvent(now: Date, settings: DashboardSettings) {
  const refreshToken = process.env.GOOGLE_PERSONAL_REFRESH_TOKEN;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const tomtomKey = process.env.TOMTOM_API_KEY;
  const origin = process.env.HOME_COORDS;

  if (!refreshToken || !clientId || !clientSecret) {
    return unavailable("personal calendar not configured");
  }
  if (!tomtomKey || !origin) {
    return unavailable("commute not configured");
  }

  const todayKey = dayKeyInTimezone(now);
  const timeMin = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  let raw;
  try {
    raw = await fetchGoogleCalendarEvents(refreshToken, timeMin, timeMax);
  } catch (error) {
    return unavailable((error as Error).message);
  }

  const todaysEvents = raw
    .filter((item) => item.start?.dateTime && item.end?.dateTime && item.id && item.location)
    .map((item) => ({
      id: item.id!,
      title: item.summary ?? "(no title)",
      start: new Date(item.start!.dateTime!),
      location: item.location!,
    }))
    .filter((e) => dayKeyInTimezone(e.start) === todayKey && e.start.getTime() > now.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const anchor = todaysEvents[0];
  if (anchor) {
    const destination = await geocodeAddress(anchor.location);
    if (!destination) {
      return unavailable(`couldn't find a location for "${anchor.title}"`);
    }

    let leaveByResult;
    try {
      leaveByResult = await computeLeaveBy(
        anchor.start,
        destination,
        settings.personalArrivalBufferMinutes,
      );
    } catch (error) {
      return unavailable((error as Error).message);
    }

    const tight =
      leaveByResult.leaveBy.getTime() + leaveByResult.travelTimeMinutes * 60 * 1000 >
      anchor.start.getTime();

    return NextResponse.json<CommutePlanResponse>({
      mode: "personal",
      destinationLabel: anchor.title,
      destinationCoords: destination,
      hero: {
        durationMinutes: leaveByResult.travelTimeMinutes,
        distanceMiles: leaveByResult.distanceMiles,
        trafficCondition: leaveByResult.trafficCondition,
        live: false,
      },
      leaveBy: {
        time: leaveByResult.leaveBy.toISOString(),
        travelTimeMinutes: leaveByResult.travelTimeMinutes,
        eventTitle: anchor.title,
        eventStart: anchor.start.toISOString(),
        trafficCondition: leaveByResult.trafficCondition,
        tight,
      },
    });
  }

  // No specific-time event today — fall back to an all-day event with
  // a location (e.g. a multi-day trip or reunion). There's no target
  // time to plan a "leave by" around, so this just shows the live ETA,
  // the same way the work/Sunday destinations do.
  const allDayEvents = raw
    .filter(
      (item) =>
        item.start?.date && !item.start?.dateTime && item.end?.date && item.id && item.location,
    )
    .map((item) => ({
      id: item.id!,
      title: item.summary ?? "(no title)",
      startKey: item.start!.date!,
      endKey: item.end!.date!, // exclusive, per Google's all-day convention
      location: item.location!,
    }))
    .filter((e) => e.startKey <= todayKey && todayKey < e.endKey)
    .sort((a, b) => a.startKey.localeCompare(b.startKey));

  const allDayAnchor = allDayEvents[0];
  if (!allDayAnchor) {
    return unavailable("no upcoming personal event with a location today");
  }

  const destination = await geocodeAddress(allDayAnchor.location);
  if (!destination) {
    return unavailable(`couldn't find a location for "${allDayAnchor.title}"`);
  }

  try {
    const eta = await getCurrentEta(origin, destination);
    return NextResponse.json<CommutePlanResponse>({
      mode: "personal",
      destinationLabel: allDayAnchor.title,
      destinationCoords: destination,
      hero: {
        durationMinutes: eta.durationInTrafficMinutes,
        distanceMiles: eta.distanceMiles,
        trafficDelayMinutes: eta.trafficDelayMinutes,
        trafficCondition: eta.trafficCondition,
        live: true,
      },
    });
  } catch (error) {
    return unavailable((error as Error).message);
  }
}

// ---- Sunday: fixed destinations, live ETA only, no leave-by. ----
async function planFixedDestination(mode: "church" | "bountiful") {
  const tomtomKey = process.env.TOMTOM_API_KEY;
  const origin = process.env.HOME_COORDS;
  const destination =
    mode === "church" ? process.env.CHURCH_COORDS : process.env.BOUNTIFUL_COORDS;

  if (!tomtomKey || !origin || !destination) {
    return unavailable(`${mode} commute not configured`);
  }

  try {
    const eta = await getCurrentEta(origin, destination);
    return NextResponse.json<CommutePlanResponse>({
      mode,
      destinationLabel: mode === "church" ? "Church" : "Bountiful",
      destinationCoords: destination,
      hero: {
        durationMinutes: eta.durationInTrafficMinutes,
        distanceMiles: eta.distanceMiles,
        trafficDelayMinutes: eta.trafficDelayMinutes,
        trafficCondition: eta.trafficCondition,
        live: true,
      },
    });
  } catch (error) {
    return unavailable((error as Error).message);
  }
}

export async function GET() {
  const now = new Date();
  const settings = await getSettings();

  if (isSunday(now)) {
    return hourInTimezone(now) < settings.sundayNoonCutoffHour
      ? planFixedDestination("church")
      : planFixedDestination("bountiful");
  }

  if (isWeekend(now)) {
    return planPersonalEvent(now, settings);
  }

  return hourInTimezone(now) < settings.afternoonCutoffHour
    ? planWorkMeeting(now, settings)
    : planPersonalEvent(now, settings);
}
