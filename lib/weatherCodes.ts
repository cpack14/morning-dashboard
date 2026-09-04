export const WEATHER_CODES: Record<number, { label: string; icon: string }> = {
  0: { label: "Clear sky", icon: "☀️" },
  1: { label: "Mostly clear", icon: "🌤️" },
  2: { label: "Partly cloudy", icon: "⛅" },
  3: { label: "Overcast", icon: "☁️" },
  45: { label: "Fog", icon: "🌫️" },
  48: { label: "Rime fog", icon: "🌫️" },
  51: { label: "Light drizzle", icon: "🌦️" },
  53: { label: "Drizzle", icon: "🌦️" },
  55: { label: "Heavy drizzle", icon: "🌧️" },
  56: { label: "Freezing drizzle", icon: "🌧️" },
  57: { label: "Freezing drizzle", icon: "🌧️" },
  61: { label: "Light rain", icon: "🌧️" },
  63: { label: "Rain", icon: "🌧️" },
  65: { label: "Heavy rain", icon: "🌧️" },
  66: { label: "Freezing rain", icon: "🌨️" },
  67: { label: "Freezing rain", icon: "🌨️" },
  71: { label: "Light snow", icon: "🌨️" },
  73: { label: "Snow", icon: "🌨️" },
  75: { label: "Heavy snow", icon: "❄️" },
  77: { label: "Snow grains", icon: "❄️" },
  80: { label: "Light showers", icon: "🌦️" },
  81: { label: "Showers", icon: "🌧️" },
  82: { label: "Heavy showers", icon: "⛈️" },
  85: { label: "Snow showers", icon: "🌨️" },
  86: { label: "Heavy snow showers", icon: "❄️" },
  95: { label: "Thunderstorm", icon: "⛈️" },
  96: { label: "Thunderstorm w/ hail", icon: "⛈️" },
  99: { label: "Thunderstorm w/ hail", icon: "⛈️" },
};

export function describeWeatherCode(code: number) {
  return WEATHER_CODES[code] ?? { label: "Unknown", icon: "❔" };
}

export type WeatherEffectCategory =
  | "clear"
  | "cloudy"
  | "fog"
  | "rain"
  | "snow"
  | "thunderstorm";

// WMO codes grouped for the on-screen weather effect (falling rain/snow,
// fog haze, etc.) — a coarser view of the same codes describeWeatherCode
// already maps to labels/icons, so both stay driven by one source.
const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const FOG_CODES = new Set([45, 48]);
const THUNDERSTORM_CODES = new Set([95, 96, 99]);
const CLOUDY_CODES = new Set([2, 3]);

// Light/moderate/heavy, used to scale particle count and fall speed.
const LIGHT_CODES = new Set([51, 56, 61, 71, 80]);
const HEAVY_CODES = new Set([55, 57, 65, 66, 67, 75, 77, 82, 86]);

export function categorizeWeatherCode(code: number): {
  category: WeatherEffectCategory;
  intensity: 1 | 2 | 3;
} {
  let category: WeatherEffectCategory = "clear";
  if (THUNDERSTORM_CODES.has(code)) category = "thunderstorm";
  else if (SNOW_CODES.has(code)) category = "snow";
  else if (RAIN_CODES.has(code)) category = "rain";
  else if (FOG_CODES.has(code)) category = "fog";
  else if (CLOUDY_CODES.has(code)) category = "cloudy";

  const intensity: 1 | 2 | 3 = THUNDERSTORM_CODES.has(code)
    ? 3
    : LIGHT_CODES.has(code)
      ? 1
      : HEAVY_CODES.has(code)
        ? 3
        : 2;

  return { category, intensity };
}
