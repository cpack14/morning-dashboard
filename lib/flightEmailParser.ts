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
};

export type ParsedItinerary = {
  confirmationNumber: string;
  legs: ParsedLeg[];
};

const MONTHS: Record<string, string> = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
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

// Schedule blocks look like (after compacting):
//   17NOVDEPARTARRIVE
//   DELTA 1095
//   Delta Comfort Classic (S)
//   SALT LAKE CITY
//   09:28AM
//   LOS ANGELES
//   10:29AM
// Cabin line varies by fare — "Delta Comfort Classic (S)", "Delta
// Main (U)", etc. — so it's matched loosely by shape (starts with
// "Delta", ends with a single-letter fare code in parens) rather than
// requiring any specific fare name.
const LEG_SCHEDULE_RE =
  /\d{1,2}[A-Z]{3}DEPARTARRIVE\nDELTA (\d+)\nDelta [^\n]*\([A-Z]\)\n[A-Z /-]+\n(\d{1,2}:\d{2}(?:AM|PM))\n[A-Z /-]+\n(\d{1,2}:\d{2}(?:AM|PM))/g;

// The "Checked Bag Allowance" section restates each leg with a full
// date (year included) and the actual 3-letter airport codes, e.g.
// "Tue 17 Nov 2026SLC-LAX" — the only place in the email either of
// those appears.
const LEG_DATE_CODE_RE =
  /\w{3} (\d{1,2}) (\w{3}) (\d{4})([A-Z]{3})-([A-Z]{3})/g;

export type ParseFailure = { reason: string };

export function parseDeltaFlightReceipt(
  body: string,
): ParsedItinerary | ParseFailure {
  const compact = compactLines(body);

  const confirmationMatch = compact.match(/Confirmation Number\n([A-Z0-9]{5,8})/);
  if (!confirmationMatch) {
    return { reason: "couldn't find a confirmation number" };
  }

  const schedules = [...compact.matchAll(LEG_SCHEDULE_RE)];
  const dateCodes = [...compact.matchAll(LEG_DATE_CODE_RE)];

  if (schedules.length === 0) {
    return { reason: "couldn't find any flight segments" };
  }

  if (schedules.length !== dateCodes.length) {
    // A day with more baggage-section legs than schedule-section
    // blocks means a connecting flight (multiple segments under one
    // DEPARTARRIVE header) — not supported yet, rather than guessed at.
    return {
      reason:
        dateCodes.length > schedules.length
          ? "looks like a connecting flight (multiple segments in one day) — not supported yet"
          : "flight segment count didn't match between sections of the email",
    };
  }

  const legs: ParsedLeg[] = schedules.map((schedule, i) => {
    const [, flightNumber, departureTime, arrivalTime] = schedule;
    const [, day, monthName, year, originCode, destCode] = dateCodes[i];

    const month = MONTHS[monthName];
    const dateKey = `${year}-${month}-${day.padStart(2, "0")}`;

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
      };
    }

    const depTime = to24Hour(departureTime);
    const arrTime = to24Hour(arrivalTime);

    const departure = zonedTimeToUtc(dateKey, depTime.hour, depTime.minute, origin.timezone);
    let arrival = zonedTimeToUtc(dateKey, arrTime.hour, arrTime.minute, dest.timezone);

    // No arrival date is given separately — if treating it as the same
    // calendar day as departure puts it before departure, the flight
    // must cross midnight, so try the next day instead.
    if (arrival.getTime() < departure.getTime()) {
      const nextDay = new Date(departure.getTime());
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const nextDateKey = nextDay.toISOString().slice(0, 10);
      arrival = zonedTimeToUtc(nextDateKey, arrTime.hour, arrTime.minute, dest.timezone);
    }

    const durationMinutes = Math.round((arrival.getTime() - departure.getTime()) / 60000);

    return {
      flightNumber: `DELTA ${flightNumber}`,
      originCode,
      destCode,
      departure,
      arrival,
      durationMinutes,
      unknownAirportCode: null,
    };
  });

  return { confirmationNumber: confirmationMatch[1], legs };
}
