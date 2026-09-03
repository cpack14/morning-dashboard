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

export function CommuteCard() {
  const { data, error } = useFetchPoll<CommuteResponse>(
    "/api/commute",
    60 * 1000,
  );

  return (
    <Card title="Commute">
      {error && <Unavailable reason={error} />}
      {!error && !data && <Unavailable reason="loading" />}
      {!error && data && "unavailable" in data && (
        <Unavailable reason={data.reason} />
      )}
      {!error && data && !("unavailable" in data) && (
        <div>
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
        </div>
      )}
    </Card>
  );
}
