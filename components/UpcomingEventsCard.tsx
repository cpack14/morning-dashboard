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

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
  });
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
      <span className="w-[4.5em] shrink-0 text-muted tabular-nums">
        {formatDateLabel(new Date(event.start))}
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
