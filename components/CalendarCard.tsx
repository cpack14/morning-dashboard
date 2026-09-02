"use client";

import { Card, Unavailable } from "@/components/Card";
import { useFetchPoll } from "@/lib/useFetchPoll";

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
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

function EventRow({ event }: { event: CalendarEvent }) {
  const dotClass =
    event.calendar === "work" ? "bg-accent-work" : "bg-accent-personal";

  return (
    <li className="flex items-baseline gap-4">
      <span className={`h-4 w-4 shrink-0 rounded-full ${dotClass}`} />
      <span className="w-32 shrink-0 text-2xl text-muted tabular-nums">
        {formatTime(event)}
      </span>
      <span className="text-3xl">{event.title}</span>
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
        <div className="grid grid-cols-2 gap-10">
          <div>
            <p className="mb-4 text-xl text-muted uppercase tracking-wide">
              Today
            </p>
            {today.length === 0 ? (
              <p className="text-3xl text-muted">Nothing scheduled</p>
            ) : (
              <ul className="space-y-3">
                {today.map((e) => (
                  <EventRow key={e.id} event={e} />
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-4 text-xl text-muted uppercase tracking-wide">
              Tomorrow
            </p>
            {tomorrow.length === 0 ? (
              <p className="text-3xl text-muted">Nothing scheduled</p>
            ) : (
              <ul className="space-y-3">
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
