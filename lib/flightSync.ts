import { redis } from "@/lib/kv";
import { searchGmailMessages, getGmailMessagePlainText } from "@/lib/googleGmail";
import { createGoogleCalendarEvent } from "@/lib/googleCalendar";
import { parseDeltaFlightReceipt, type ParsedLeg } from "@/lib/flightEmailParser";
import { AIRPORTS } from "@/lib/airports";

// newer_than bounds this to recently-*received* emails (not flight
// date) so the search doesn't keep re-scanning years of old bookings
// forever — 180 days comfortably covers booking a trip that far out.
const SEARCH_QUERY =
  'from:DeltaAirLines@t.delta.com subject:"Flight Receipt" newer_than:180d';
const SYNCED_KEY_PREFIX = "flight:synced:";
const PRE_FLIGHT_BUFFER_MINUTES = 2 * 60;
const POST_FLIGHT_BUFFER_MINUTES = 90;

export type FlightSyncResult = {
  emailsChecked: number;
  newItinerariesSynced: number;
  eventsCreated: number;
  warnings: string[];
};

async function alreadySynced(confirmationNumber: string): Promise<boolean> {
  return Boolean(await redis.get(SYNCED_KEY_PREFIX + confirmationNumber));
}

async function markSynced(confirmationNumber: string): Promise<void> {
  await redis.set(SYNCED_KEY_PREFIX + confirmationNumber, true);
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// The full treatment: a 3-hour pre-flight block, the flight itself,
// and a 1.5-hour post-flight block — written to the work calendar.
async function createPaddedEventsForLeg(
  refreshToken: string,
  leg: ParsedLeg,
  confirmationNumber: string,
): Promise<number> {
  if (!leg.departure || !leg.arrival || leg.durationMinutes === null) {
    return 0;
  }

  const origin = AIRPORTS[leg.originCode];
  const dest = AIRPORTS[leg.destCode];
  let created = 0;

  const preStart = new Date(leg.departure.getTime() - PRE_FLIGHT_BUFFER_MINUTES * 60000);
  await createGoogleCalendarEvent(refreshToken, {
    summary: "Airport",
    description: `Heading to ${origin.name} for ${leg.flightNumber} (confirmation ${confirmationNumber})`,
    start: { dateTime: preStart.toISOString(), timeZone: origin.timezone },
    end: { dateTime: leg.departure.toISOString(), timeZone: origin.timezone },
  });
  created++;

  created += await createFlightEvent(refreshToken, leg, confirmationNumber);

  const postEnd = new Date(leg.arrival.getTime() + POST_FLIGHT_BUFFER_MINUTES * 60000);
  await createGoogleCalendarEvent(refreshToken, {
    summary: "Airport",
    description: `Arrived via ${leg.flightNumber} (confirmation ${confirmationNumber})`,
    start: { dateTime: leg.arrival.toISOString(), timeZone: dest.timezone },
    end: { dateTime: postEnd.toISOString(), timeZone: dest.timezone },
  });
  created++;

  return created;
}

// Just the flight itself, no padding — written to the personal
// calendar, which already has its own commute/prep logic elsewhere
// in the dashboard that doesn't need a duplicate "Airport" block.
async function createFlightEvent(
  refreshToken: string,
  leg: ParsedLeg,
  confirmationNumber: string,
): Promise<number> {
  if (!leg.departure || !leg.arrival || leg.durationMinutes === null) {
    return 0;
  }

  const origin = AIRPORTS[leg.originCode];
  const dest = AIRPORTS[leg.destCode];

  await createGoogleCalendarEvent(refreshToken, {
    summary: `${leg.flightNumber}: ${leg.originCode} → ${leg.destCode}`,
    description: `Duration: ${formatDuration(leg.durationMinutes)}\nConfirmation: ${confirmationNumber}`,
    location: origin.name,
    start: { dateTime: leg.departure.toISOString(), timeZone: origin.timezone },
    end: { dateTime: leg.arrival.toISOString(), timeZone: dest.timezone },
  });

  return 1;
}

export async function syncDeltaFlights(
  personalRefreshToken: string,
  workRefreshToken: string,
): Promise<FlightSyncResult> {
  const messages = await searchGmailMessages(personalRefreshToken, SEARCH_QUERY);
  const result: FlightSyncResult = {
    emailsChecked: messages.length,
    newItinerariesSynced: 0,
    eventsCreated: 0,
    warnings: [],
  };

  for (const message of messages) {
    const body = await getGmailMessagePlainText(personalRefreshToken, message.id);
    if (!body) {
      result.warnings.push(`Couldn't read email body (message ${message.id})`);
      continue;
    }

    const parsed = parseDeltaFlightReceipt(body);
    if ("reason" in parsed) {
      result.warnings.push(`Skipped an email — ${parsed.reason} (message ${message.id})`);
      continue;
    }
    const itinerary = parsed;

    if (await alreadySynced(itinerary.confirmationNumber)) {
      continue;
    }

    let sawUnknownAirport = false;

    for (const leg of itinerary.legs) {
      if (leg.unknownAirportCode) {
        sawUnknownAirport = true;
        result.warnings.push(
          `Unknown airport "${leg.unknownAirportCode}" on ${leg.flightNumber} ` +
            `(confirmation ${itinerary.confirmationNumber}) — add it to lib/airports.ts, then re-sync.`,
        );
        continue;
      }
      // The Gmail search matches every "Flight Receipt" ever received,
      // not just upcoming trips — skip anything that's already flown
      // rather than backfilling calendar clutter for past travel.
      if (leg.departure && leg.departure.getTime() < Date.now()) {
        continue;
      }
      result.eventsCreated += await createPaddedEventsForLeg(
        workRefreshToken,
        leg,
        itinerary.confirmationNumber,
      );
      result.eventsCreated += await createFlightEvent(
        personalRefreshToken,
        leg,
        itinerary.confirmationNumber,
      );
    }

    // An unknown-airport leg is fixable (add the airport, re-sync) —
    // don't mark the whole itinerary done, or it'll never get retried
    // even after the fix.
    if (!sawUnknownAirport) {
      await markSynced(itinerary.confirmationNumber);
    }
    result.newItinerariesSynced++;
  }

  return result;
}
