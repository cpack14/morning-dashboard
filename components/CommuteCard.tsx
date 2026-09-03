"use client";

import { Card, Unavailable } from "@/components/Card";
import { useFetchPoll } from "@/lib/useFetchPoll";

type CommuteResponse =
  | { unavailable: true; reason: string }
  | {
      durationInTrafficMinutes: number;
      durationNoTrafficMinutes: number;
      distanceMiles: number;
      trafficDelayMinutes: number;
    };

type CommutePlanResponse = {
  suggestion: {
    meetingTitle: string;
    meetingStart: string;
    leaveBy: string;
    travelTimeMinutes: number;
    trafficCondition: "light" | "average" | "heavy";
    clampedByPreviousMeeting: boolean;
    tight: boolean;
  } | null;
  reason?: string;
};

const CONDITION_COLOR: Record<string, string> = {
  heavy: "text-accent-warn",
  average: "text-muted",
  light: "text-accent-personal",
};

function LeaveBySuggestion({ data }: { data: CommutePlanResponse }) {
  if (!data.suggestion) return null;
  const s = data.suggestion;

  const leaveTime = new Date(s.leaveBy).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const meetingTime = new Date(s.meetingStart).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="mt-auto border-t border-surface-border pt-[1vh]">
      <p className={`text-body font-medium ${CONDITION_COLOR[s.trafficCondition]}`}>
        Traffic is {s.trafficCondition} today — leave by {leaveTime}
      </p>
      <p className="text-label text-muted">
        for &ldquo;{s.meetingTitle}&rdquo; at {meetingTime}
        {s.tight && " · cutting it close"}
      </p>
    </div>
  );
}

export function CommuteCard() {
  const { data, error } = useFetchPoll<CommuteResponse>(
    "/api/commute",
    60 * 1000,
  );
  const { data: planData } = useFetchPoll<CommutePlanResponse>(
    "/api/commute-plan",
    5 * 60 * 1000,
  );

  return (
    <Card title="Commute">
      {error && <Unavailable reason={error} />}
      {!error && !data && <Unavailable reason="loading" />}
      {!error && data && "unavailable" in data && (
        <Unavailable reason={data.reason} />
      )}
      {!error && data && !("unavailable" in data) && (
        <div className="flex h-full flex-col">
          <div className="text-hero font-semibold tabular-nums">
            {data.durationInTrafficMinutes}
            <span className="text-hero-sub font-normal text-muted"> min</span>
          </div>
          <p className="text-hero-sub mt-[0.5vh] text-muted">
            {data.distanceMiles} mi
            {data.trafficDelayMinutes > 2 && (
              <span className="text-accent-warn">
                {" "}
                · +{data.trafficDelayMinutes} min traffic
              </span>
            )}
          </p>
          {planData && <LeaveBySuggestion data={planData} />}
        </div>
      )}
    </Card>
  );
}
