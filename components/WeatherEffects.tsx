"use client";

import { useMemo } from "react";
import { useFetchPoll } from "@/lib/useFetchPoll";
import type { WeatherEffectCategory } from "@/lib/weatherCodes";

const POLL_MS = 10 * 60 * 1000;

type WeatherResponse =
  | { unavailable: true }
  | {
      current: { category: WeatherEffectCategory; intensity: 1 | 2 | 3 };
    };

const PARTICLE_COUNT: Record<1 | 2 | 3, number> = { 1: 25, 2: 45, 3: 70 };
// Snow reads sparser than rain at the same count (bigger, slower,
// more spread-out flakes vs. fast thin streaks), so it gets its own,
// denser scale.
const SNOW_PARTICLE_COUNT: Record<1 | 2 | 3, number> = { 1: 50, 2: 90, 3: 140 };

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function RainLayer({ intensity }: { intensity: 1 | 2 | 3 }) {
  const drops = useMemo(() => {
    const count = PARTICLE_COUNT[intensity];
    // Heavier rain falls faster, not just more of it.
    const durationRange: [number, number] =
      intensity === 3 ? [0.35, 0.55] : intensity === 2 ? [0.5, 0.75] : [0.7, 1.0];
    return Array.from({ length: count }, () => ({
      left: randomBetween(0, 100),
      duration: randomBetween(...durationRange),
      delay: randomBetween(0, 2),
      height: randomBetween(14, 26),
    }));
  }, [intensity]);

  return (
    <>
      {drops.map((d, i) => (
        <div
          key={i}
          className="absolute top-0 w-[1.5px] rounded-full bg-gradient-to-b from-transparent via-sky-200/70 to-transparent"
          style={{
            left: `${d.left}%`,
            height: `${d.height}px`,
            transform: "rotate(8deg)",
            animation: `weather-fall ${d.duration}s linear ${d.delay}s infinite`,
          }}
        />
      ))}
    </>
  );
}

function SnowLayer({ intensity }: { intensity: 1 | 2 | 3 }) {
  const flakes = useMemo(() => {
    const count = SNOW_PARTICLE_COUNT[intensity];
    const durationRange: [number, number] =
      intensity === 3 ? [4, 6] : intensity === 2 ? [5.5, 8] : [7, 10];
    return Array.from({ length: count }, () => ({
      left: randomBetween(0, 100),
      duration: randomBetween(...durationRange),
      delay: randomBetween(0, 8),
      size: randomBetween(3, 6),
    }));
  }, [intensity]);

  return (
    <>
      {flakes.map((f, i) => (
        <div
          key={i}
          className="absolute top-0 rounded-full bg-white/80"
          style={{
            left: `${f.left}%`,
            width: `${f.size}px`,
            height: `${f.size}px`,
            animation: `weather-drift ${f.duration}s linear ${f.delay}s infinite`,
          }}
        />
      ))}
    </>
  );
}

function FogLayer() {
  return (
    <div
      className="absolute inset-0"
      style={{
        background:
          "linear-gradient(120deg, transparent, rgba(200,210,220,0.35), transparent, rgba(200,210,220,0.25), transparent)",
        backgroundSize: "250% 100%",
        animation: "weather-fog-drift 40s ease-in-out infinite alternate",
      }}
    />
  );
}

function LightningLayer() {
  const flashDuration = useMemo(() => randomBetween(9, 18), []);
  return (
    <div
      className="absolute inset-0 bg-white"
      style={{ animation: `weather-flash ${flashDuration}s ease-in-out infinite` }}
    />
  );
}

export function WeatherEffects() {
  const { data } = useFetchPoll<WeatherResponse>("/api/weather", POLL_MS);

  if (!data || "unavailable" in data) return null;

  const { category, intensity } = data.current;
  if (category === "clear" || category === "cloudy") return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden opacity-20">
      {category === "rain" && <RainLayer intensity={intensity} />}
      {category === "snow" && <SnowLayer intensity={intensity} />}
      {category === "thunderstorm" && (
        <>
          <RainLayer intensity={3} />
          <LightningLayer />
        </>
      )}
      {category === "fog" && <FogLayer />}
    </div>
  );
}
