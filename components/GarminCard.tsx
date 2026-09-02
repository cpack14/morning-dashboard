"use client";

import { Card, Unavailable } from "@/components/Card";
import { useFetchPoll } from "@/lib/useFetchPoll";

type GarminResponse =
  | { unavailable: true; reason: string }
  | {
      steps?: number;
      restingHeartRate?: number;
      sleepHours?: number;
      bodyBattery?: number;
    };

function Stat({ label, value }: { label: string; value?: number }) {
  if (value === undefined) return null;
  return (
    <div>
      <p className="text-xl text-muted uppercase tracking-wide">{label}</p>
      <p className="text-4xl tabular-nums">{value}</p>
    </div>
  );
}

export function GarminCard() {
  const { data, error } = useFetchPoll<GarminResponse>(
    "/api/garmin",
    15 * 60 * 1000,
  );

  return (
    <Card title="Garmin">
      {error && <Unavailable reason={error} />}
      {!error && !data && <Unavailable reason="loading" />}
      {!error && data && "unavailable" in data && (
        <Unavailable reason={data.reason} />
      )}
      {!error && data && !("unavailable" in data) && (
        <div className="grid grid-cols-2 gap-6">
          <Stat label="Steps" value={data.steps} />
          <Stat label="Resting HR" value={data.restingHeartRate} />
          <Stat label="Sleep (hrs)" value={data.sleepHours} />
          <Stat label="Body Battery" value={data.bodyBattery} />
        </div>
      )}
    </Card>
  );
}
