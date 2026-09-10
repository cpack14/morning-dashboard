"use client";

import { useState } from "react";

type SyncResult = {
  emailsChecked: number;
  newItinerariesSynced: number;
  eventsCreated: number;
  warnings: string[];
};

export function SyncFlightsButton() {
  const [status, setStatus] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [result, setResult] = useState<SyncResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSync() {
    setStatus("syncing");
    setResult(null);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/flights/sync", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error ?? "Sync failed");
        setStatus("error");
        return;
      }
      setResult(data);
      setStatus("done");
    } catch {
      setErrorMessage("Sync failed");
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleSync}
        disabled={status === "syncing"}
        className={`self-start rounded-lg px-4 py-2 text-sm font-medium ${
          status === "syncing"
            ? "cursor-wait bg-surface text-muted"
            : "bg-accent-work text-foreground"
        }`}
      >
        {status === "syncing" ? "Syncing…" : "Sync Flights"}
      </button>

      {status === "done" && result && (
        <p className="text-xs text-muted">
          Checked {result.emailsChecked} email{result.emailsChecked === 1 ? "" : "s"} —{" "}
          {result.newItinerariesSynced === 0
            ? "nothing new"
            : `${result.newItinerariesSynced} new trip${result.newItinerariesSynced === 1 ? "" : "s"}, ${result.eventsCreated} event${result.eventsCreated === 1 ? "" : "s"} added`}
          .
          {result.warnings.length > 0 && (
            <span className="mt-1 block text-accent-warn">
              {result.warnings.map((w, i) => (
                <span key={i} className="block">
                  ⚠️ {w}
                </span>
              ))}
            </span>
          )}
        </p>
      )}

      {status === "error" && (
        <p className="text-xs text-accent-warn">⚠️ {errorMessage}</p>
      )}
    </div>
  );
}
