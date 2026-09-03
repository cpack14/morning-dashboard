import { NextResponse } from "next/server";
import { describeWeatherCode } from "@/lib/weatherCodes";
import { HOME_TIMEZONE } from "@/lib/workout";

export const dynamic = "force-dynamic";

const HOURS_TO_SHOW = 8;

function currentHourKey(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:00`;
}

// Open-Meteo's hourly.time entries are naive local wall-clock strings
// (e.g. "2026-09-02T19:00") for the requested lat/lon, which matches
// HOME_TIMEZONE by construction. Format the label from the string
// directly rather than via Date, so it's correct regardless of the
// timezone of whatever device ends up rendering this.
function formatHourLabel(isoLocal: string) {
  const hour24 = Number(isoLocal.slice(11, 13));
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12} ${period}`;
}

export async function GET() {
  const lat = process.env.HOME_LAT;
  const lon = process.env.HOME_LON;

  if (!lat || !lon) {
    return NextResponse.json(
      { unavailable: true, reason: "HOME_LAT / HOME_LON not configured" },
      { status: 200 },
    );
  }

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", lat);
  url.searchParams.set("longitude", lon);
  url.searchParams.set("current", "temperature_2m,weather_code,is_day");
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,weather_code",
  );
  url.searchParams.set("hourly", "temperature_2m,weather_code");
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "2");

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Open-Meteo returned ${res.status}`);
    }
    const data = await res.json();

    const current = {
      tempF: Math.round(data.current.temperature_2m),
      ...describeWeatherCode(data.current.weather_code),
    };

    const today = {
      highF: Math.round(data.daily.temperature_2m_max[0]),
      lowF: Math.round(data.daily.temperature_2m_min[0]),
      ...describeWeatherCode(data.daily.weather_code[0]),
    };

    const nowKey = currentHourKey(HOME_TIMEZONE);
    const startIndex = (data.hourly.time as string[]).findIndex(
      (t) => t >= nowKey,
    );
    const sliceStart = startIndex === -1 ? 0 : startIndex;

    const hourly = (data.hourly.time as string[])
      .slice(sliceStart, sliceStart + HOURS_TO_SHOW)
      .map((time, i) => {
        const idx = sliceStart + i;
        return {
          hourLabel: formatHourLabel(time),
          tempF: Math.round(data.hourly.temperature_2m[idx]),
          ...describeWeatherCode(data.hourly.weather_code[idx]),
        };
      });

    return NextResponse.json({ current, today, hourly });
  } catch (error) {
    return NextResponse.json(
      { unavailable: true, reason: (error as Error).message },
      { status: 200 },
    );
  }
}
