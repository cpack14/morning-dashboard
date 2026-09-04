"use client";

import { Card, Unavailable } from "@/components/Card";
import { FittedList } from "@/components/FittedList";
import { MarqueeText } from "@/components/MarqueeText";
import { useFetchPoll } from "@/lib/useFetchPoll";

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  calendar: "work" | "personal";
};

type CalendarResponse = {
  accounts: Partial<Record<"work" | "personal", boolean>>;
  events: CalendarEvent[];
  errors: Partial<Record<"work" | "personal" | "general", string>>;
};

function formatClock(date: Date) {
  const hour24 = date.getHours();
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const minutes = date.getMinutes();
  const hourMin =
    minutes === 0 ? `${hour12}` : `${hour12}:${String(minutes).padStart(2, "0")}`;
  return { hourMin, period };
}

function formatTimeRange(event: CalendarEvent) {
  if (event.allDay) return "All day";

  const start = formatClock(new Date(event.start));
  const end = formatClock(new Date(event.end));

  if (start.period === end.period) {
    return `${start.hourMin}-${end.hourMin} ${end.period}`;
  }
  return `${start.hourMin} ${start.period}-${end.hourMin} ${end.period}`;
}

function EventRow({ event }: { event: CalendarEvent }) {
  const dotClass =
    event.calendar === "work" ? "bg-accent-work" : "bg-accent-personal";

  return (
    <li className="flex items-baseline gap-[0.5em] overflow-hidden">
      <span
        className={`h-[0.5em] w-[0.5em] shrink-0 rounded-full ${dotClass}`}
      />
      <span className="shrink-0 text-muted tabular-nums">
        {formatTimeRange(event)}
      </span>
      <MarqueeText text={event.title} className="min-w-0 flex-1" />
    </li>
  );
}

export function CalendarCard() {
  const { data, error } = useFetchPoll<CalendarResponse>(
    "/api/calendar",
    10 * 60 * 1000,
  );

  const notConfigured =
    data && !data.accounts.work && !data.accounts.personal;

  const events = data?.events ?? [];

  return (
    <Card title="Today's Meetings">
      {error && <Unavailable reason={error} />}
      {!error && !data && <Unavailable reason="loading" />}
      {!error && notConfigured && (
        <Unavailable reason={data?.errors.general ?? "no accounts configured"} />
      )}
      {!error && data && !notConfigured && (
        <>
          {events.length === 0 ? (
            <p className="text-body text-muted">No meetings today</p>
          ) : (
            <FittedList
              items={events.map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
            />
          )}
        </>
      )}
    </Card>
  );
}
