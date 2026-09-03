"use client";

import { useEffect, useRef, useState } from "react";

const RAMP_DURATION_MS = 30_000;
const MAX_PLAY_DURATION_MS = 3 * 60 * 1000;
const MIN_VOLUME = 0.03;
const MAX_VOLUME = 1.0;
const POLL_MS = 60_000;
const MAX_STALE_MS = 15 * 60 * 1000;
const SNOOZE_MS = 10 * 60 * 1000;
const FIRED_KEY = "morningDashboardAlarmFiredDate";

function todayKey() {
  return new Date().toLocaleDateString("en-CA");
}

// Renders an always-present, silent <audio> element and watches the
// clock itself. Frank's only job is making sure the TV/screen is on
// and this page is loaded a few minutes before the computed wake
// time — the actual decision to start the alarm happens here, by
// polling /api/wake-time and comparing to "now".
//
// Dismissal is via an on-screen modal with real focusable buttons —
// Fire TV's D-pad navigation drives those reliably, unlike raw
// keydown/click listeners, which don't reliably fire from remote
// button presses in this WebView.
export function AlarmController() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const rampIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snoozeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [active, setActive] = useState(false);

  // Manual trigger for testing: append ?alarm=1 to the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("alarm") !== "1") return;

    setActive(true);

    const url = new URL(window.location.href);
    url.searchParams.delete("alarm");
    window.history.replaceState({}, "", url.toString());
  }, []);

  // Real trigger: poll the computed wake time and fire once per day
  // when "now" reaches it (within a 15-minute window, so a page load
  // long after a missed window doesn't fire a stale alarm).
  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (localStorage.getItem(FIRED_KEY) === todayKey()) return;

      try {
        const res = await fetch("/api/wake-time", { cache: "no-store" });
        const data = await res.json();
        if (!data.wakeTime) return;

        const elapsed = Date.now() - new Date(data.wakeTime).getTime();
        if (elapsed < 0) return;

        localStorage.setItem(FIRED_KEY, todayKey());
        if (elapsed <= MAX_STALE_MS && !cancelled) {
          setActive(true);
        }
      } catch {
        // Transient failure — just try again on the next poll.
      }
    };

    check();
    const interval = setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = MIN_VOLUME;
    audio.currentTime = 0;
    audio.play().catch(() => {});

    const start = Date.now();
    rampIntervalRef.current = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / RAMP_DURATION_MS);
      audio.volume = MIN_VOLUME + (MAX_VOLUME - MIN_VOLUME) * t;
      if (t >= 1 && rampIntervalRef.current) {
        clearInterval(rampIntervalRef.current);
        rampIntervalRef.current = null;
      }
    }, 500);

    maxTimerRef.current = setTimeout(stopAlarm, MAX_PLAY_DURATION_MS);

    return () => {
      if (rampIntervalRef.current) clearInterval(rampIntervalRef.current);
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    return () => {
      if (snoozeTimerRef.current) clearTimeout(snoozeTimerRef.current);
    };
  }, []);

  function stopAlarm() {
    if (rampIntervalRef.current) clearInterval(rampIntervalRef.current);
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setActive(false);
  }

  function snoozeAlarm() {
    stopAlarm();
    snoozeTimerRef.current = setTimeout(() => setActive(true), SNOOZE_MS);
  }

  return (
    <>
      <audio ref={audioRef} src="/alarm-chime.mp3" loop preload="auto" />
      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="flex flex-col items-center gap-[2vh] rounded-2xl border border-surface-border bg-surface p-[4vh]">
            <p className="text-hero-sub">Good morning!</p>
            <div className="flex gap-[2vh]">
              <button
                autoFocus
                onClick={stopAlarm}
                className="text-body rounded-xl bg-accent-work px-[3vh] py-[1.5vh] font-medium text-foreground focus:outline-none focus:ring-4 focus:ring-white"
              >
                Stop
              </button>
              <button
                onClick={snoozeAlarm}
                className="text-body rounded-xl border border-surface-border px-[3vh] py-[1.5vh] font-medium text-muted focus:outline-none focus:ring-4 focus:ring-white"
              >
                Snooze 10 min
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
