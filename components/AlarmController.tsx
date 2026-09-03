"use client";

import { useEffect, useRef, useState } from "react";

const RAMP_DURATION_MS = 30_000;
const MAX_PLAY_DURATION_MS = 3 * 60 * 1000;
const MIN_VOLUME = 0.03;
const MAX_VOLUME = 1.0;
const POLL_MS = 60_000;
const MAX_STALE_MS = 15 * 60 * 1000;
const FIRED_KEY = "morningDashboardAlarmFiredDate";

function todayKey() {
  return new Date().toLocaleDateString("en-CA");
}

// Renders an always-present, silent <audio> element and watches the
// clock itself. Frank's only job is making sure the TV/screen is on
// and this page is loaded a few minutes before the computed wake
// time — the actual decision to start the alarm happens here, by
// polling /api/wake-time and comparing to "now". This means the
// alarm doesn't depend on any signal from Frank at all, and would
// even fire correctly if the dashboard just happens to already be
// on screen for some other reason.
export function AlarmController() {
  const audioRef = useRef<HTMLAudioElement>(null);
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
  // when "now" reaches it.
  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (localStorage.getItem(FIRED_KEY) === todayKey()) return;

      try {
        const res = await fetch("/api/wake-time", { cache: "no-store" });
        const data = await res.json();
        if (!data.wakeTime) return;

        const elapsed = Date.now() - new Date(data.wakeTime).getTime();
        if (elapsed < 0) return; // not time yet

        // Mark today as handled either way, so a page load hours after
        // a missed window doesn't fire a stale alarm — but also doesn't
        // keep re-checking (and re-fetching calendar data) all day.
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
    const rampInterval = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / RAMP_DURATION_MS);
      audio.volume = MIN_VOLUME + (MAX_VOLUME - MIN_VOLUME) * t;
      if (t >= 1) clearInterval(rampInterval);
    }, 500);

    const stop = () => {
      clearInterval(rampInterval);
      audio.pause();
      audio.currentTime = 0;
      setActive(false);
    };

    const maxTimer = setTimeout(stop, MAX_PLAY_DURATION_MS);

    window.addEventListener("keydown", stop);
    window.addEventListener("click", stop);

    return () => {
      clearInterval(rampInterval);
      clearTimeout(maxTimer);
      window.removeEventListener("keydown", stop);
      window.removeEventListener("click", stop);
    };
  }, [active]);

  return <audio ref={audioRef} src="/alarm-chime.mp3" loop preload="auto" />;
}
