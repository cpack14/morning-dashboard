import { NextRequest, NextResponse } from "next/server";
import { getSecurityStatus, setSecurityStatus } from "@/lib/securityStatus";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = await getSecurityStatus();
  return NextResponse.json({ state });
}

// Called by an IFTTT applet watching the Ring alarm's Away/Disarmed
// state. Requires a shared-secret token since this one actually gates
// whether the TV/alarm can fire, unlike the app's other read-only data.
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token || token !== process.env.SECURITY_STATUS_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const state = body?.state;
  if (state !== "away" && state !== "home") {
    return NextResponse.json(
      { error: "body must be {\"state\": \"away\" | \"home\"}" },
      { status: 400 },
    );
  }

  await setSecurityStatus(state);
  return NextResponse.json({ ok: true, state });
}
