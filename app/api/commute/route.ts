import { NextResponse } from "next/server";
import { getCurrentEta } from "@/lib/currentEta";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.TOMTOM_API_KEY;
  const origin = process.env.HOME_COORDS;
  const destination = process.env.WORK_COORDS;

  if (!apiKey || !origin || !destination) {
    return NextResponse.json(
      {
        unavailable: true,
        reason: "TOMTOM_API_KEY / HOME_COORDS / WORK_COORDS not configured",
      },
      { status: 200 },
    );
  }

  try {
    const eta = await getCurrentEta(origin, destination);
    return NextResponse.json({ ...eta, updatedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json(
      { unavailable: true, reason: (error as Error).message },
      { status: 200 },
    );
  }
}
