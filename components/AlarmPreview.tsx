"use client";

import { useEffect, useState } from "react";

type WakeTimeResponse = {
  wakeTime: string | null;
  reason?: string;
  silent?: boolean;
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function AlarmPreview() {
  const [data, setData] = useState<WakeTimeResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/wake-time?day=tomorrow", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return null;

  if (data.reason === "away") {
    return <p className="text-sm text-muted">😴 Away mode is on — no alarm tomorrow.</p>;
  }

  if (!data.wakeTime) {
    return <p className="text-sm text-muted">Couldn&apos;t figure out tomorrow&apos;s alarm.</p>;
  }

  const time = formatTime(data.wakeTime);

  if (data.silent) {
    return (
      <p className="text-sm text-muted">
        🔇 Screen turns on silently at {time} tomorrow — no alarm sound.
      </p>
    );
  }

  return <p className="text-sm text-muted">⏰ Your alarm is set for {time} tomorrow.</p>;
}
