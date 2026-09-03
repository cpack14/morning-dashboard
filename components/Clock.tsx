"use client";

import { useEffect, useState } from "react";

export function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <div
        className="text-clock font-semibold tabular-nums tracking-tight"
        suppressHydrationWarning
      >
        {now.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        })}
      </div>
      <div className="text-date mt-[0.5vh] text-muted" suppressHydrationWarning>
        {now.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      </div>
    </div>
  );
}
