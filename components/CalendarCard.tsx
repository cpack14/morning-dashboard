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

function formatTime(event: CalendarEvent) {
  if (event.allDay) return "All day";
  return new Date(event.start).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(event: CalendarEvent) {
  if (event.allDay) return null;
  const totalMinutes = Math.round(
    (new Date(event.end).getTime() - new Date(event.start).getTime()) / 60000,
  );
  if (totalMinutes <= 0) return null;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function EventRow({ event }: { event: CalendarEvent }) {
  const dotClass =
    event.calendar === "work" ? "bg-accent-work" : "bg-accent-personal";
  const duration = formatDuration(event);

  return (
    <li className="flex items-baseline gap-[0.6vh] overflow-hidden">
      <span
        className={`h-[0.8vh] w-[0.8vh] shrink-0 rounded-full ${dotClass}`}
      />
      <span className="text-body w-[8.5em] shrink-0 text-muted tabular-nums">
        {formatTime(event)}
        {duration && ` · ${duration}`}
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
