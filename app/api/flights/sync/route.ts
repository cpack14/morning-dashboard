import { NextResponse } from "next/server";
import { syncDeltaFlights } from "@/lib/flightSync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET (not POST) because Vercel Cron always issues a GET request to
// the configured path — this same route also serves the manual "Sync
// Flights" button, which is safe to reuse since re-syncing an
// already-synced confirmation number is a no-op (see flightSync.ts).
export async function GET() {
  const personalRefreshToken = process.env.GOOGLE_PERSONAL_REFRESH_TOKEN;
  const workRefreshToken = process.env.GOOGLE_WORK_REFRESH_TOKEN;
  if (!personalRefreshToken || !workRefreshToken) {
    return NextResponse.json(
      { error: "personal and/or work calendar not configured" },
      { status: 500 },
    );
  }

  try {
    const result = await syncDeltaFlights(personalRefreshToken, workRefreshToken);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
