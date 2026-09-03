import { NextResponse } from "next/server";
import { describeWeatherCode } from "@/lib/weatherCodes";
import { HOME_TIMEZONE } from "@/lib/workout";

export const dynamic = "force-dynamic";

const HOURS_TO_SHOW = 6;

function localDateParts(timeZone: string, date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  const hour = get("hour") === "24" ? "00" : get("hour");
  return { dateStr: `${get("year")}-${get("month")}-${get("day")}`, hour };
}

function currentHourKey(timeZone: string) {
  const { dateStr, hour } = localDateParts(timeZone, new Date());
  return `${dateStr}T${hour}:00`;
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

// Same naive-local-string handling as formatHourLabel, but keeping
// minutes since sunrise/sunset rarely land on the hour.
function formatTimeLabel(isoLocal: string) {
  const hour24 = Number(isoLocal.slice(11, 13));
  const minute = isoLocal.slice(14, 16);
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute} ${period}`;
}

function categorizeAqi(aqi: number): string {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Moderate";
  if (aqi <= 150) return "Unhealthy for Sensitive Groups";
  if (aqi <= 200) return "Unhealthy";
  if (aqi <= 300) return "Very Unhealthy";
  return "Hazardous";
}

// Best-effort — air quality is a bonus on top of the weather card, so
// a hiccup here shouldn't take down the rest of it.
async function fetchAqi(
  lat: string,
  lon: string,
): Promise<{ aqi: number; category: string } | null> {
  try {
    const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
    url.searchParams.set("latitude", lat);
    url.searchParams.set("longitude", lon);
    url.searchParams.set("current", "us_aqi");
    url.searchParams.set("timezone", "auto");

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    const aqi = Math.round(data.current?.us_aqi);
    if (!Number.isFinite(aqi)) return null;
    return { aqi, category: categorizeAqi(aqi) };
  } catch {
    return null;
  }
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
    "temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,rain_sum,snowfall_sum",
  );
  url.searchParams.set("hourly", "temperature_2m,weather_code");
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("precipitation_unit", "inch");
  url.searchParams.set("timezone", "auto");

  // Open-Meteo's `forecast_days` appears to anchor "today" to the API's
  // current UTC date rather than the requested location's local date,
  // which causes an off-by-one once UTC has crossed midnight but the
  // location hasn't (e.g. evening in US timezones). Request an explicit
  // local date range instead so "today" always matches HOME_TIMEZONE.
  const now = new Date();
  const { dateStr: todayLocal } = localDateParts(HOME_TIMEZONE, now);
  const { dateStr: tomorrowLocal } = localDateParts(
    HOME_TIMEZONE,
    new Date(now.getTime() + 24 * 60 * 60 * 1000),
  );
  url.searchParams.set("start_date", todayLocal);
  url.searchParams.set("end_date", tomorrowLocal);

  try {
    const [res, aqi] = await Promise.all([
      fetch(url, { cache: "no-store" }),
      fetchAqi(lat, lon),
    ]);
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
      sunrise: formatTimeLabel(data.daily.sunrise[0]),
      sunset: formatTimeLabel(data.daily.sunset[0]),
      rainIn: Math.round((data.daily.rain_sum?.[0] ?? 0) * 100) / 100,
      snowIn: Math.round((data.daily.snowfall_sum?.[0] ?? 0) * 100) / 100,
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

    return NextResponse.json({ current, today, hourly, aqi });
  } catch (error) {
    return NextResponse.json(
      { unavailable: true, reason: (error as Error).message },
      { status: 200 },
    );
  }
}
