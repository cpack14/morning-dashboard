import { NextResponse } from "next/server";
import { fetchGoogleCalendarEvents } from "@/lib/googleCalendar";

export const dynamic = "force-dynamic";

const DAYS_AHEAD = 10;

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_PERSONAL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return NextResponse.json({
      events: [],
      error: "personal calendar not configured",
    });
  }

  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(
    now.getTime() + DAYS_AHEAD * 24 * 60 * 60 * 1000,
  ).toISOString();

  try {
    const raw = await fetchGoogleCalendarEvents(
      refreshToken,
      timeMin,
      timeMax,
      50,
    );

    const events = raw
      .filter((item) => item.id && (item.start?.dateTime || item.start?.date))
      .map((item) => {
        const start = item.start!.dateTime ?? item.start!.date!;
        const end =
          item.end?.dateTime ?? item.end?.date ?? item.start!.dateTime ?? item.start!.date!;
        return {
          id: item.id!,
          title: item.summary ?? "(no title)",
          start,
          end,
          allDay: Boolean(item.start?.date && !item.start?.dateTime),
        };
      })
      .sort((a, b) => a.start.localeCompare(b.start));

    return NextResponse.json({ events });
  } catch (error) {
    return NextResponse.json({ events: [], error: (error as Error).message });
  }
}
