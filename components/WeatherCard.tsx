"use client";

import { Card, Unavailable } from "@/components/Card";
import { useFetchPoll } from "@/lib/useFetchPoll";

type HourlyForecast = {
  hourLabel: string;
  tempF: number;
  label: string;
  icon: string;
};

type WeatherResponse =
  | {
      unavailable: true;
      reason: string;
    }
  | {
      current: { tempF: number; label: string; icon: string };
      today: {
        highF: number;
        lowF: number;
        sunrise: string;
        sunset: string;
        label: string;
        icon: string;
      };
      hourly: HourlyForecast[];
      aqi: { aqi: number; category: string } | null;
    };

const AQI_COLOR: Record<string, string> = {
  Good: "text-accent-personal",
  Moderate: "text-muted",
  "Unhealthy for Sensitive Groups": "text-accent-warn",
  Unhealthy: "text-accent-warn",
  "Very Unhealthy": "text-accent-danger",
  Hazardous: "text-accent-danger",
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
          <div className="flex items-start justify-between gap-[1vh]">
            <div>
              <div className="flex items-center gap-[1vh]">
                <span className="text-hero">{data.current.icon}</span>
                <span className="text-hero font-semibold tabular-nums">
                  {data.current.tempF}°
                </span>
              </div>
              <p className="text-hero-sub mt-[0.5vh] text-muted">
                {data.current.label}
              </p>
              {data.aqi && (
                <p className={`text-label ${AQI_COLOR[data.aqi.category] ?? "text-muted"}`}>
                  AQI {data.aqi.aqi} · {data.aqi.category}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-label text-muted uppercase tracking-wide">
                Today
              </p>
              <p className="text-hero-sub whitespace-nowrap">
                {data.today.icon} {data.today.highF}° / {data.today.lowF}°
              </p>
              <p className="text-label whitespace-nowrap text-muted">
                ☀️ {data.today.sunrise} · 🌇 {data.today.sunset}
              </p>
            </div>
          </div>

          <div className="mt-auto flex justify-between gap-[0.5vh] overflow-hidden border-t border-surface-border pt-[1vh]">
            {data.hourly.map((h, i) => (
              <div key={i} className="flex shrink-0 flex-col items-center">
                <p className="text-body text-muted">{h.hourLabel}</p>
                <p className="text-hero-sub">{h.icon}</p>
                <p className="text-body tabular-nums">{h.tempF}°</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
