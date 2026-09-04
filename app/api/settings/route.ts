import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

// Read-only — writes only ever happen from the settings page's own
// server action, so there's no POST here (unlike security-status,
// which also has an external caller).
export async function GET() {
  const settings = await getSettings();
  return NextResponse.json(settings);
}
