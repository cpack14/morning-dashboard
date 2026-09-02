import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const statsUrl = process.env.GARMIN_STATS_URL;

  if (!statsUrl) {
    return NextResponse.json(
      { unavailable: true, reason: "GARMIN_STATS_URL not configured" },
      { status: 200 },
    );
  }

  try {
    const res = await fetch(statsUrl, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Garmin stats source returned ${res.status}`);
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { unavailable: true, reason: (error as Error).message },
      { status: 200 },
    );
  }
}
