import { NextResponse } from "next/server";
import { HOME_TIMEZONE } from "@/lib/workout";
import { dayKeyInTimezone, hourInTimezone, isWeekend } from "@/lib/timezone";
import { fetchGoogleCalendarEvents } from "@/lib/googleCalendar";
import { computeLeaveBy } from "@/lib/commuteLeaveBy";
import { getSecurityStatus } from "@/lib/securityStatus";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

type CalendarKey = "work" | "personal";
type TimedMeeting = { start: Date; calendar: CalendarKey };

// Converts a wall-clock time in the given IANA timezone to the correct
// UTC instant, accounting for DST.
function zonedTimeToUtc(
  dateKey: string,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  // Treat the target wall-clock time as if it were UTC — wrong, but a
  // reasonable starting point for finding the zone's offset near it.
  const naiveUtc = new Date(
    `${dateKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`,
  );

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(naiveUtc);
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  const hh = get("hour") === "24" ? "00" : get("hour");

  // What naiveUtc's instant actually reads as in the target zone,
  // itself misread as UTC — the gap between this and naiveUtc is
  // exactly the zone's offset at that instant.
  const shownAsUtc = new Date(
    `${get("year")}-${get("month")}-${get("day")}T${hh}:${get("minute")}:${get("second")}Z`,
  );
  const offset = shownAsUtc.getTime() - naiveUtc.getTime();

  return new Date(naiveUtc.getTime() - offset);
}

function result(wakeTime: Date | null, reason?: string, meetingStart?: Date) {
  return NextResponse.json({
    wakeTime: wakeTime ? wakeTime.toISOString() : null,
    meetingStart: meetingStart ? meetingStart.toISOString() : null,
    reason,
  });
}

export async function GET() {
  const now = new Date();
  const settings = await getSettings();

  if ((await getSecurityStatus()) === "away") {
    return result(null, "away");
  }

  if (isWeekend(now)) {
    return result(null, "weekend");
  }

  const todayKey = dayKeyInTimezone(now);
  const timeMin = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshTokens: Partial<Record<CalendarKey, string>> = {
    work: process.env.GOOGLE_WORK_REFRESH_TOKEN,
    personal: process.env.GOOGLE_PERSONAL_REFRESH_TOKEN,
  };

  const meetings: TimedMeeting[] = [];

  if (clientId && clientSecret) {
    for (const key of Object.keys(refreshTokens) as CalendarKey[]) {
      const token = refreshTokens[key];
      if (!token) continue;

      try {
        const raw = await fetchGoogleCalendarEvents(token, timeMin, timeMax);
        for (const item of raw) {
          if (!item.start?.dateTime || !item.end?.dateTime) continue;
          const start = new Date(item.start.dateTime);
          if (dayKeyInTimezone(start) !== todayKey) continue;
          if (start.getTime() <= now.getTime()) continue;
          meetings.push({ start, calendar: key });
        }
      } catch {
        // Ignore this account's failure — the alarm should still work
        // off whatever calendar data we could get.
      }
    }
  }

  meetings.sort((a, b) => a.start.getTime() - b.start.getTime());
  const firstMeeting = meetings[0];

  if (!firstMeeting) {
    const wakeTime = zonedTimeToUtc(
      todayKey,
      settings.defaultWakeHour,
      settings.defaultWakeMinute,
      HOME_TIMEZONE,
    );
    return result(wakeTime, "no meetings today, default weekday wake time");
  }

  const isEarly = hourInTimezone(firstMeeting.start) < settings.earlyMeetingCutoffHour;

  if (isEarly || firstMeeting.calendar !== "work") {
    const wakeTime = new Date(
      firstMeeting.start.getTime() - settings.getReadyMinutes * 60 * 1000,
    );
    return result(wakeTime, undefined, firstMeeting.start);
  }

  try {
    const { leaveBy } = await computeLeaveBy(
      firstMeeting.start,
      process.env.WORK_COORDS ?? "",
      settings.workArrivalBufferMinutes,
    );
    const wakeTime = new Date(
      leaveBy.getTime() - settings.getReadyMinutes * 60 * 1000,
    );
    return result(wakeTime, undefined, firstMeeting.start);
  } catch (error) {
    return result(null, (error as Error).message);
  }
}
