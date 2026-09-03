// Turns a free-text location (as found on a calendar event) into a
// "lat,lon" string matching the format used by HOME_COORDS/WORK_COORDS
// elsewhere. Uses TomTom's Search API rather than plain Geocoding —
// Geocoding is address-only and silently returns a wrong low-confidence
// street match for business/place names (e.g. "Olive Garden" resolved
// to an unrelated street called "Garden Bend Place"), whereas Search
// handles both structured addresses and POI/business names correctly.
export async function geocodeAddress(query: string): Promise<string | null> {
  const apiKey = process.env.TOMTOM_API_KEY;
  if (!apiKey || !query.trim()) return null;

  const encoded = encodeURIComponent(query.trim());
  const url = `https://api.tomtom.com/search/2/search/${encoded}.json?key=${apiKey}&limit=1`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    const position = data.results?.[0]?.position;
    if (!position) return null;
    return `${position.lat},${position.lon}`;
  } catch {
    return null;
  }
}
