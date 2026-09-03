"use client";

import { Card, Unavailable } from "@/components/Card";
import { useFetchPoll } from "@/lib/useFetchPoll";

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  calendar: "work" | "personal";
  day: "today" | "tomorrow";
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
  const hourMin = minutes === 0 ? `${hour12}` : `${hour12}:${String(minutes).padStart(2, "0")}`;
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
    <li className="flex items-baseline gap-[0.6vh] overflow-hidden">
      <span
        className={`h-[0.8vh] w-[0.8vh] shrink-0 rounded-full ${dotClass}`}
      />
      <span className="text-body shrink-0 text-muted tabular-nums">
        {formatTimeRange(event)}
      </span>
      <span className="text-body truncate">{event.title}</span>
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

  const today = data?.events.filter((e) => e.day === "today") ?? [];
  const tomorrow = data?.events.filter((e) => e.day === "tomorrow") ?? [];

  return (
    <Card title="Calendar">
      {error && <Unavailable reason={error} />}
      {!error && !data && <Unavailable reason="loading" />}
      {!error && notConfigured && (
        <Unavailable reason={data?.errors.general ?? "no accounts configured"} />
      )}
      {!error && data && !notConfigured && (
        <div className="grid h-full grid-cols-2 gap-[2vh]">
          <div className="min-h-0 overflow-hidden">
            <p className="text-label mb-[0.8vh] text-muted uppercase tracking-wide">
              Today
            </p>
            {today.length === 0 ? (
              <p className="text-body text-muted">Nothing scheduled</p>
            ) : (
              <ul className="space-y-[0.6vh]">
                {today.map((e) => (
                  <EventRow key={e.id} event={e} />
                ))}
              </ul>
            )}
          </div>
          <div className="min-h-0 overflow-hidden">
            <p className="text-label mb-[0.8vh] text-muted uppercase tracking-wide">
              Tomorrow
            </p>
            {tomorrow.length === 0 ? (
              <p className="text-body text-muted">Nothing scheduled</p>
            ) : (
              <ul className="space-y-[0.6vh]">
                {tomorrow.map((e) => (
                  <EventRow key={e.id} event={e} />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
