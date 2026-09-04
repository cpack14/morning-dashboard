"use client";

import { Card, Unavailable } from "@/components/Card";
import { FittedList } from "@/components/FittedList";
import { MarqueeText } from "@/components/MarqueeText";
import { useFetchPoll } from "@/lib/useFetchPoll";

type UpcomingEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
};

type UpcomingResponse = {
  events: UpcomingEvent[];
  error?: string;
};

// All-day dates come as bare "YYYY-MM-DD" strings — parsing those with
// `new Date(string)` reads them as UTC midnight, which shifts a day
// off in any negative UTC-offset timezone once toLocaleDateString
// renders it in local time. Parsing the components directly into a
// local Date sidesteps that entirely.
function parseEventDate(iso: string, allDay: boolean): Date {
  if (allDay) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(iso);
}

// Google's all-day `end` is exclusive (one day past the actual last
// day), so the displayed last day needs to step back by one.
function lastInclusiveDay(event: UpcomingEvent): Date {
  const end = parseEventDate(event.end, event.allDay);
  if (event.allDay) {
    return new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1);
  }
  return end;
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "numeric", day: "numeric" });
}

function formatDateLabel(event: UpcomingEvent) {
  const start = parseEventDate(event.start, event.allDay);
  const end = lastInclusiveDay(event);

  if (start.toDateString() === end.toDateString()) {
    return start.toLocaleDateString("en-US", {
      weekday: "short",
      month: "numeric",
      day: "numeric",
    });
  }
  return `${formatShortDate(start)}–${formatShortDate(end)}`;
}

function formatTimeLabel(event: UpcomingEvent) {
  if (event.allDay) return "All day";
  return new Date(event.start).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function UpcomingRow({ event }: { event: UpcomingEvent }) {
  return (
    <li className="flex items-baseline gap-[0.5em] overflow-hidden">
      <span className="w-[6.5em] shrink-0 whitespace-nowrap text-muted tabular-nums">
        {formatDateLabel(event)}
      </span>
      <span className="w-[4.5em] shrink-0 text-muted tabular-nums">
        {formatTimeLabel(event)}
      </span>
      <MarqueeText text={event.title} className="min-w-0 flex-1" />
    </li>
  );
}

export function UpcomingEventsCard() {
  const { data, error } = useFetchPoll<UpcomingResponse>(
    "/api/upcoming-events",
    15 * 60 * 1000,
  );

  return (
    <Card title="Upcoming Events">
      {error && <Unavailable reason={error} />}
      {!error && !data && <Unavailable reason="loading" />}
      {!error && data?.error && <Unavailable reason={data.error} />}
      {!error &&
        data &&
        !data.error &&
        (data.events.length === 0 ? (
          <p className="text-body text-muted">Nothing in the next 10 days</p>
        ) : (
          <FittedList
            items={data.events.map((e) => (
              <UpcomingRow key={e.id} event={e} />
            ))}
          />
        ))}
    </Card>
  );
}
