"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Card, Unavailable } from "@/components/Card";
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

const MIN_SCALE = 0.6;
const SCALE_STEP = 0.05;

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
      <span className="truncate">{event.title}</span>
    </li>
  );
}

// Shrinks font size to fit as many events as possible, then hides
// whatever's left from the bottom and shows a "+N more" line rather
// than silently cutting off the last visible event.
function FittedEventList({ events }: { events: CalendarEvent[] }) {
  const listRef = useRef<HTMLUListElement>(null);
  const [scale, setScale] = useState(1);
  const [hiddenCount, setHiddenCount] = useState(0);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const items = Array.from(list.children) as HTMLElement[];
    items.forEach((li) => {
      li.style.display = "";
    });

    let currentScale = 1;
    list.style.setProperty("--cal-scale", "1");
    const fits = () => list.scrollHeight <= list.clientHeight + 1;

    while (!fits() && currentScale > MIN_SCALE) {
      currentScale = Math.max(MIN_SCALE, currentScale - SCALE_STEP);
      list.style.setProperty("--cal-scale", String(currentScale));
    }

    let currentHidden = 0;
    if (!fits()) {
      for (let hideFrom = items.length - 1; hideFrom >= 0; hideFrom--) {
        for (let i = hideFrom; i < items.length; i++) {
          items[i].style.display = "none";
        }
        currentHidden = items.length - hideFrom;
        if (fits()) break;
      }
    }

    setScale(currentScale);
    setHiddenCount(currentHidden);
  }, [events]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ul
        ref={listRef}
        className="min-h-0 flex-1 space-y-[0.4em] overflow-hidden"
        style={{ fontSize: `calc(var(--text-body) * ${scale})` }}
      >
        {events.map((e) => (
          <EventRow key={e.id} event={e} />
        ))}
      </ul>
      <p
        className={`text-label mt-[0.3em] shrink-0 text-muted ${hiddenCount > 0 ? "" : "invisible"}`}
      >
        +{hiddenCount || 1} more
      </p>
    </div>
  );
}

export function CalendarCard() {
  const { data, error } = useFetchPoll<CalendarResponse>(
    "/api/calendar",
    10 * 60 * 1000,
  );

  const notConfigured =
    data && !data.accounts.work && !data.accounts.personal;

  const now = new Date();
  const upcoming =
    data?.events.filter((e) => e.allDay || new Date(e.end) > now) ?? [];

  return (
    <Card title="Calendar">
      {error && <Unavailable reason={error} />}
      {!error && !data && <Unavailable reason="loading" />}
      {!error && notConfigured && (
        <Unavailable reason={data?.errors.general ?? "no accounts configured"} />
      )}
      {!error && data && !notConfigured && (
        <>
          {upcoming.length === 0 ? (
            <p className="text-body text-muted">Nothing left today</p>
          ) : (
            <FittedEventList events={upcoming} />
          )}
        </>
      )}
    </Card>
  );
}
