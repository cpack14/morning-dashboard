"use client";

import { Card, Unavailable } from "@/components/Card";
import { useFetchPoll } from "@/lib/useFetchPoll";

type CommutePlanResponse =
  | {
      mode: "work" | "personal" | "church" | "bountiful";
      destinationLabel: string;
      hero: {
        durationMinutes: number;
        distanceMiles: number;
        trafficDelayMinutes?: number;
        trafficCondition?: "light" | "moderate" | "heavy";
        live: boolean;
      };
      leaveBy?: {
        time: string;
        travelTimeMinutes: number;
        eventTitle: string;
        eventStart: string;
        trafficCondition: "light" | "moderate" | "heavy";
        tight: boolean;
      };
    }
  | { mode: "unavailable"; reason: string };

const CONDITION_COLOR: Record<string, string> = {
  heavy: "text-accent-warn",
  moderate: "text-muted",
  light: "text-accent-personal",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function CommuteContext({
  data,
}: {
  data: Extract<CommutePlanResponse, { mode: string }>;
}) {
  if (data.mode === "unavailable") return null;

  if (data.leaveBy) {
    const s = data.leaveBy;
    return (
      <div className="mt-auto border-t border-surface-border pt-[1vh]">
        <p className={`text-body font-medium ${CONDITION_COLOR[s.trafficCondition]}`}>
          Leave by {formatTime(s.time)} ({s.travelTimeMinutes} min) — traffic
          is usually {s.trafficCondition}
        </p>
        <p className="text-label text-muted">
          for &ldquo;{s.eventTitle}&rdquo; at {formatTime(s.eventStart)}
          {s.tight && " · cutting it close"}
        </p>
      </div>
    );
  }

  return null;
}

export function CommuteCard() {
  const { data, error } = useFetchPoll<CommutePlanResponse>(
    "/api/commute-plan",
    60 * 1000,
  );

  return (
    <Card title="Current Commute">
      {error && <Unavailable reason={error} />}
      {!error && !data && <Unavailable reason="loading" />}
      {!error && data && data.mode === "unavailable" && (
        <Unavailable reason={data.reason} />
      )}
      {!error && data && data.mode !== "unavailable" && (
        <div className="flex h-full flex-col">
          <div className="text-hero font-semibold tabular-nums">
            {data.hero.durationMinutes}
            <span className="text-hero-sub font-normal text-muted">
              {" "}
              min to {data.destinationLabel}
            </span>
          </div>
          <p className="text-hero-sub mt-[0.5vh] text-muted">
            {data.hero.distanceMiles} mi
            {data.hero.trafficCondition && (
              <span className={CONDITION_COLOR[data.hero.trafficCondition]}>
                {" "}
                · traffic is {data.hero.trafficCondition}
                {data.hero.trafficDelayMinutes !== undefined &&
                  data.hero.trafficDelayMinutes > 2 &&
                  ` (+${data.hero.trafficDelayMinutes} min)`}
              </span>
            )}
          </p>
          <CommuteContext data={data} />
        </div>
      )}
    </Card>
  );
}
