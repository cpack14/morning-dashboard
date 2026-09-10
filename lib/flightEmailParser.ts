import { zonedTimeToUtc } from "@/lib/timezone";
import { AIRPORTS } from "@/lib/airports";

export type ParsedLeg = {
  flightNumber: string;
  originCode: string;
  destCode: string;
  // null when the airport code isn't in AIRPORTS — the caller decides
  // how to surface that rather than this module guessing at a timezone.
  departure: Date | null;
  arrival: Date | null;
  durationMinutes: number | null;
  unknownAirportCode: string | null;
  // A "DEPARTARRIVE" header can cover more than one flight segment —
  // a connection. These mark the boundaries of that group so the
  // caller only pads before the first segment and after the last,
  // never between connecting segments.
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
};

export type ParsedItinerary = {
  confirmationNumber: string;
  legs: ParsedLeg[];
};

// Keyed upper-case — the header's month text is all-caps
// ("17NOVDEPARTARRIVE") while the baggage section's is title-case
// ("17 Nov 2026"), so every lookup below normalizes to this.
const MONTHS: Record<string, string> = {
  JAN: "01",
  FEB: "02",
  MAR: "03",
  APR: "04",
  MAY: "05",
  JUN: "06",
  JUL: "07",
  AUG: "08",
  SEP: "09",
  OCT: "10",
  NOV: "11",
  DEC: "12",
};

// Delta's plain-text emails are a flattened HTML table — most "cells"
// come through as blank or whitespace-only lines. Stripping those
// first turns the noisy original into a compact, reliably-ordered
// sequence of the actual content lines, which is what the regexes
// below are written against.
function compactLines(body: string): string {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

function to24Hour(time12h: string): { hour: number; minute: number } {
  const match = time12h.match(/(\d{1,2}):(\d{2})(AM|PM)/i);
  if (!match) throw new Error(`Unrecognized time format: ${time12h}`);
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();
  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  return { hour, minute };
}

// Marks the start of each travel day's block, e.g. "17NOVDEPARTARRIVE"
// — one of these can be followed by more than one flight segment when
// it's a connection.
const GROUP_HEADER_RE = /(\d{1,2})([A-Z]{3})DEPARTARRIVE/g;

// A single flight segment, e.g. (after compacting):
//   DELTA 1095
//   Delta Comfort Classic (S)
//   SALT LAKE CITY
//   09:28AM
//   LOS ANGELES
//   10:29AM
// Cabin line varies by fare — "Delta Comfort Classic (S)", "Delta
// Main (U)", etc. — so it's matched loosely by shape (starts with
// "Delta", ends with a single-letter fare code in parens) rather than
// requiring any specific fare name. A trailing "*" on the flight
// number (codeshare footnote marker, e.g. "DELTA 4153*") is dropped.
const SEGMENT_RE =
  /DELTA (\d+)\*?\nDelta [^\n]*\([A-Z]\)\n[A-Z /-]+\n(\d{1,2}:\d{2}(?:AM|PM))\n[A-Z /-]+\n(\d{1,2}:\d{2}(?:AM|PM))/g;

// "Fare Details: SLC DL X/ATL DL SAV Q27.91 ... DL X/ATL DL SLC258.60 ...END"
// — a fare-construction string that's the one reliable source of the
// *exact* per-segment routing, including connection points ("X/ATL")
// that the "Checked Bag Allowance" section sometimes collapses out of
// existence when a connection shares one bag allowance for the whole
// day. Present in every itinerary email, direct or connecting.
const FARE_DETAILS_RE = /Fare Details:\s*([\s\S]*?)END/;
const WAYPOINT_RE = /(?:^|DL)\s*X?\/?([A-Z]{3})/g;

// The "Checked Bag Allowance" section restates each travel day with a
// full date (year included), e.g. "Tue 17 Nov 2026SLC-LAX" — the only
// place a year appears in the email. Its airport codes aren't used
// (see above); only the date, matched to a DEPARTARRIVE header by
// day+month.
const DATE_ROW_RE = /\w{3} (\d{1,2}) (\w{3}) (\d{4})[A-Z]{3}-[A-Z]{3}/g;

export type ParseFailure = { reason: string };

export function parseDeltaFlightReceipt(
  body: string,
): ParsedItinerary | ParseFailure {
  const compact = compactLines(body);

  const confirmationMatch = compact.match(/Confirmation Number\n([A-Z0-9]{5,8})/);
  if (!confirmationMatch) {
    return { reason: "couldn't find a confirmation number" };
  }

  const headers = [...compact.matchAll(GROUP_HEADER_RE)];
  const segments = [...compact.matchAll(SEGMENT_RE)];

  if (segments.length === 0) {
    return { reason: "couldn't find any flight segments" };
  }

  const fareDetailsMatch = compact.match(FARE_DETAILS_RE);
  if (!fareDetailsMatch) {
    return { reason: "couldn't find the fare details routing string" };
  }
  const waypoints = [...fareDetailsMatch[1].matchAll(WAYPOINT_RE)].map((m) => m[1]);
  if (waypoints.length !== segments.length + 1) {
    return { reason: "routing string didn't match the number of flight segments" };
  }

  // Header months are all-caps ("17NOVDEPARTARRIVE"); baggage-section
  // months are title-case ("17 Nov 2026") — normalized to match.
  const dateRows = [...compact.matchAll(DATE_ROW_RE)];
  const yearByDayMonth = new Map<string, string>();
  for (const [, day, monthName, year] of dateRows) {
    yearByDayMonth.set(`${day.padStart(2, "0")}-${monthName.toUpperCase()}`, year);
  }
  for (const [, headerDay, headerMonth] of headers) {
    if (!yearByDayMonth.has(`${headerDay.padStart(2, "0")}-${headerMonth.toUpperCase()}`)) {
      return { reason: "couldn't find a year for one of the travel days" };
    }
  }

  // Each segment belongs to the most recent header that precedes it.
  const groupIndexes = segments.map((segment) => {
    let group = -1;
    for (const header of headers) {
      if ((header.index ?? 0) < (segment.index ?? 0)) group++;
      else break;
    }
    return group;
  });

  let previousArrival: Date | null = null;

  const legs: ParsedLeg[] = segments.map((segment, i) => {
    const [, flightNumber, departureTime, arrivalTime] = segment;
    const originCode = waypoints[i];
    const destCode = waypoints[i + 1];

    const isFirstInGroup = i === 0 || groupIndexes[i] !== groupIndexes[i - 1];
    const isLastInGroup =
      i === segments.length - 1 || groupIndexes[i] !== groupIndexes[i + 1];

    const header = headers[groupIndexes[i]];
    const [, headerDay, headerMonth] = header;
    // Guaranteed present — checked for every header before this map.
    const year = yearByDayMonth.get(`${headerDay.padStart(2, "0")}-${headerMonth.toUpperCase()}`)!;

    const origin = AIRPORTS[originCode];
    const dest = AIRPORTS[destCode];
    const unknownAirportCode = !origin ? originCode : !dest ? destCode : null;

    if (!origin || !dest) {
      return {
        flightNumber: `DELTA ${flightNumber}`,
        originCode,
        destCode,
        departure: null,
        arrival: null,
        durationMinutes: null,
        unknownAirportCode,
        isFirstInGroup,
        isLastInGroup,
      };
    }

    const month = MONTHS[headerMonth.toUpperCase()];
    let dateKey = `${year}-${month}-${headerDay.padStart(2, "0")}`;

    const depTime = to24Hour(departureTime);
    const arrTime = to24Hour(arrivalTime);

    let departure = zonedTimeToUtc(dateKey, depTime.hour, depTime.minute, origin.timezone);

    // No date is given per-segment, only per travel day — if this
    // segment's departure would be before the previous segment's
    // arrival (an overnight layover), it's actually the next day.
    if (previousArrival && departure.getTime() < previousArrival.getTime()) {
      const nextDay = new Date(departure.getTime());
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      dateKey = nextDay.toISOString().slice(0, 10);
      departure = zonedTimeToUtc(dateKey, depTime.hour, depTime.minute, origin.timezone);
    }

    let arrival = zonedTimeToUtc(dateKey, arrTime.hour, arrTime.minute, dest.timezone);

    // Same idea within a single segment — if the arrival time reads as
    // before departure on the same date, the flight crosses midnight.
    if (arrival.getTime() < departure.getTime()) {
      const nextDay = new Date(departure.getTime());
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const nextDateKey = nextDay.toISOString().slice(0, 10);
      arrival = zonedTimeToUtc(nextDateKey, arrTime.hour, arrTime.minute, dest.timezone);
    }

    previousArrival = arrival;

    const durationMinutes = Math.round((arrival.getTime() - departure.getTime()) / 60000);

    return {
      flightNumber: `DELTA ${flightNumber}`,
      originCode,
      destCode,
      departure,
      arrival,
      durationMinutes,
      unknownAirportCode: null,
      isFirstInGroup,
      isLastInGroup,
    };
  });

  return { confirmationNumber: confirmationMatch[1], legs };
}
