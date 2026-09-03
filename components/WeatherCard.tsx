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
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-[1vh]">
            <span className="text-hero">{data.current.icon}</span>
            <span className="text-hero font-semibold tabular-nums">
              {data.current.tempF}°
            </span>
          </div>
          <p className="text-hero-sub mt-[0.5vh] text-muted">
            {data.current.label}
          </p>

          <div className="mt-auto grid grid-cols-2 gap-[1vh] border-t border-surface-border pt-[1vh]">
            <div>
              <p className="text-label text-muted uppercase tracking-wide">
                Today
              </p>
              <p className="text-hero-sub">
                {data.today.icon} {data.today.highF}° / {data.today.lowF}°
              </p>
            </div>
            <div>
              <p className="text-label text-muted uppercase tracking-wide">
                Tomorrow
              </p>
              <p className="text-hero-sub">
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
