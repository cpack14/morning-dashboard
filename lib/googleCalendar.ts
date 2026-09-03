export type RawCalendarEvent = {
  id: string;
  summary?: string;
  location?: string;
  eventType?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  attendees?: {
    email: string;
    self?: boolean;
    resource?: boolean;
    responseStatus?: string;
  }[];
};

export async function getGoogleAccessToken(refreshToken: string) {
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

export async function fetchGoogleCalendarEvents(
  refreshToken: string,
  timeMin: string,
  timeMax: string,
  maxResults = 20,
  eventTypes?: string[],
): Promise<RawCalendarEvent[]> {
  const accessToken = await getGoogleAccessToken(refreshToken);

  const url = new URL(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
  );
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", String(maxResults));
  for (const type of eventTypes ?? []) {
    url.searchParams.append("eventTypes", type);
  }

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
