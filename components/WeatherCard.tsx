"use client";

import { Card, Unavailable } from "@/components/Card";
import { useFetchPoll } from "@/lib/useFetchPoll";

type WeatherResponse =
  | {
      unavailable: true;
      reason: string;
    }
  | {
      current: { tempF: number; label: string; icon: string };
      today: { highF: number; lowF: number; label: string; icon: string };
      tomorrow: { highF: number; lowF: number; label: string; icon: string };
    };

export function WeatherCard() {
  const { data, error } = useFetchPoll<WeatherResponse>(
    "/api/weather",
    10 * 60 * 1000,
  );

  return (
    <Card title="Weather">
      {error && <Unavailable reason={error} />}
      {!error && !data && <Unavailable reason="loading" />}
      {!error && data && "unavailable" in data && (
        <Unavailable reason={data.reason} />
      )}
      {!error && data && !("unavailable" in data) && (
        <div>
          <div className="flex items-center gap-5">
            <span className="text-8xl">{data.current.icon}</span>
            <span className="text-8xl font-semibold tabular-nums">
              {data.current.tempF}°
            </span>
          </div>
          <p className="mt-2 text-3xl text-muted">{data.current.label}</p>

          <div className="mt-8 grid grid-cols-2 gap-6 border-t border-surface-border pt-8">
            <div>
              <p className="text-xl text-muted uppercase tracking-wide">
                Today
              </p>
              <p className="text-4xl">
                {data.today.icon} {data.today.highF}° / {data.today.lowF}°
              </p>
            </div>
            <div>
              <p className="text-xl text-muted uppercase tracking-wide">
                Tomorrow
              </p>
              <p className="text-4xl">
                {data.tomorrow.icon} {data.tomorrow.highF}° /{" "}
                {data.tomorrow.lowF}°
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
