import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.TOMTOM_API_KEY;
  const origin = process.env.HOME_COORDS;
  const destination = process.env.WORK_COORDS;

  if (!apiKey || !origin || !destination) {
    return NextResponse.json(
      {
        unavailable: true,
        reason:
          "TOMTOM_API_KEY / HOME_COORDS / WORK_COORDS not configured",
      },
      { status: 200 },
    );
  }

  const url = `https://api.tomtom.com/routing/1/calculateRoute/${origin}:${destination}/json?key=${apiKey}&traffic=true&travelMode=car`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`TomTom returned ${res.status}`);
    }
    const data = await res.json();
    const summary = data.routes?.[0]?.summary;

    if (!summary) {
      throw new Error("No route summary in TomTom response");
    }

    const durationInTrafficMinutes = Math.round(
      summary.travelTimeInSeconds / 60,
    );
    const durationNoTrafficMinutes = Math.round(
      (summary.travelTimeInSeconds - summary.trafficDelayInSeconds) / 60,
    );
    const distanceMiles =
      Math.round((summary.lengthInMeters / 1609.34) * 10) / 10;
    const trafficDelayMinutes = Math.round(
      summary.trafficDelayInSeconds / 60,
    );

    return NextResponse.json({
      durationInTrafficMinutes,
      durationNoTrafficMinutes,
      distanceMiles,
      trafficDelayMinutes,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { unavailable: true, reason: (error as Error).message },
      { status: 200 },
    );
  }
}
