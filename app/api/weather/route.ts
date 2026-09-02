import { NextResponse } from "next/server";
import { describeWeatherCode } from "@/lib/weatherCodes";

export const dynamic = "force-dynamic";

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

    const tomorrow = {
      highF: Math.round(data.daily.temperature_2m_max[1]),
      lowF: Math.round(data.daily.temperature_2m_min[1]),
      ...describeWeatherCode(data.daily.weather_code[1]),
    };

    return NextResponse.json({ current, today, tomorrow });
  } catch (error) {
    return NextResponse.json(
      { unavailable: true, reason: (error as Error).message },
      { status: 200 },
    );
  }
}
