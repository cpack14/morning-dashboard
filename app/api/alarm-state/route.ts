import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/kv";

export const dynamic = "force-dynamic";

const KEY = "alarm:state";

type AlarmState = "started" | "acknowledged" | "timedOut";
type AlarmStateValue = { state: AlarmState; date: string };

const VALID_STATES: AlarmState[] = ["started", "acknowledged", "timedOut"];

// Lets the dashboard report what happened with today's alarm — Frank
// polls this after triggering a wake to decide whether to put the TV
// back to sleep (only when the alarm timed out unacknowledged).
export async function GET() {
  try {
    const value = await redis.get<AlarmStateValue>(KEY);
    return NextResponse.json(value ?? { state: null, date: null });
  } catch {
    return NextResponse.json({ state: null, date: null });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const state = body?.state;
  const date = body?.date;

  if (!VALID_STATES.includes(state) || typeof date !== "string") {
    return NextResponse.json(
      { error: "body must be {state: 'started'|'acknowledged'|'timedOut', date: 'YYYY-MM-DD'}" },
      { status: 400 },
    );
  }

  await redis.set(KEY, { state, date } satisfies AlarmStateValue);
  return NextResponse.json({ ok: true });
}
