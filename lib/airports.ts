import airportData from "@/lib/data/airports.json";

// Vendored from https://github.com/mwgg/Airports (MIT license), filtered
// to the ~7,900 entries that have a real IATA code, coordinates, and a
// timezone — regenerate lib/data/airports.json from that repo's
// airports.json if it's ever worth refreshing.
export type AirportInfo = {
  name: string;
  coords: string; // "lat,lon"
  timezone: string; // IANA zone
};

export const AIRPORTS: Record<string, AirportInfo> = airportData;
