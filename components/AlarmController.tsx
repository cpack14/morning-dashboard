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
const SOUND_HISTORY_KEY = "morningDashboardAlarmSoundHistory";

const SOUNDS = [
  "/Alarms/Aura_Tone_B.mp3",
  "/Alarms/Birds.mp3",
  "/Alarms/Daybreak.mp3",
  "/Alarms/EarlyRiser.mp3",
  "/Alarms/Melodic_Bones.mp3",
  "/Alarms/SlowMorning.mp3",
  "/Alarms/The_Wake_Up_-_Earth_Day.mp3",
];

function todayKey() {
  return new Date().toLocaleDateString("en-CA");
}

// Best-effort report of what happened with today's alarm. Frank polls
// this after triggering a wake to decide whether the TV needs to be
// put back to sleep (only when the alarm timed out unacknowledged).
async function reportAlarmState(state: "started" | "acknowledged" | "timedOut") {
  try {
    await fetch("/api/alarm-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state, date: todayKey() }),
    });
  } catch {
    // No connection — Frank's shutoff cascade just won't fire this time.
  }
}

// Monday of the given date's week, as a YYYY-MM-DD key — used to group
// "already played this week" so the rotation resets Monday.
function weekKey(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d.toLocaleDateString("en-CA");
}

type SoundHistory = {
  weekKey: string;
  played: string[];
  lastPlayed: string | null;
};

// Picks a sound for this alarm episode: never the same one played twice
// in a row, and no repeats within the same Mon-Sun week until every
// sound has had a turn (at which point the rotation just starts over,
// still respecting the no-back-to-back rule).
function pickNextSound(): string {
  let history: SoundHistory;
  try {
    const raw = localStorage.getItem(SOUND_HISTORY_KEY);
    history = raw
      ? JSON.parse(raw)
      : { weekKey: weekKey(new Date()), played: [], lastPlayed: null };
  } catch {
    history = { weekKey: weekKey(new Date()), played: [], lastPlayed: null };
  }

  const currentWeek = weekKey(new Date());
  if (history.weekKey !== currentWeek) {
    history = { weekKey: currentWeek, played: [], lastPlayed: history.lastPlayed };
  }

  let candidates = SOUNDS.filter(
    (s) => !history.played.includes(s) && s !== history.lastPlayed,
  );

  if (candidates.length === 0) {
    // Whole rotation used up this week — start a fresh cycle, but still
    // avoid repeating whatever just played.
    history.played = [];
    candidates = SOUNDS.filter((s) => s !== history.lastPlayed);
  }

  if (candidates.length === 0) {
    // Only one sound exists at all — nothing left to avoid.
    candidates = SOUNDS;
  }

  const chosen = candidates[Math.floor(Math.random() * candidates.length)];

  history.played.push(chosen);
  history.lastPlayed = chosen;

  try {
    localStorage.setItem(SOUND_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // Storage unavailable — rotation just won't persist across reloads.
  }

  return chosen;
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
  const chosenSoundRef = useRef<string | null>(null);
  const [active, setActive] = useState(false);

  function startAlarm() {
    if (!chosenSoundRef.current) {
      chosenSoundRef.current = pickNextSound();
    }
    setActive(true);
  }

  // Manual trigger for testing: append ?alarm=1 to the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("alarm") !== "1") return;

    startAlarm();

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
          startAlarm();
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

    const src = chosenSoundRef.current ?? pickNextSound();
    chosenSoundRef.current = src;
    audio.src = src;
    audio.volume = MIN_VOLUME;
    audio.currentTime = 0;
    audio.play().catch(() => {});
    reportAlarmState("started");

    const start = Date.now();
    rampIntervalRef.current = setInterval(() => {
      const t = Math.min(1, (Date.now() - start) / RAMP_DURATION_MS);
      audio.volume = MIN_VOLUME + (MAX_VOLUME - MIN_VOLUME) * t;
      if (t >= 1 && rampIntervalRef.current) {
        clearInterval(rampIntervalRef.current);
        rampIntervalRef.current = null;
      }
    }, 500);

    maxTimerRef.current = setTimeout(handleTimeout, MAX_PLAY_DURATION_MS);

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

  function pausePlayback() {
    if (rampIntervalRef.current) clearInterval(rampIntervalRef.current);
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }

  function stopAlarm() {
    pausePlayback();
    chosenSoundRef.current = null;
    setActive(false);
  }

  // Auto-stop after MAX_PLAY_DURATION_MS with no interaction — reports
  // "timedOut" so Frank knows nobody was there to hear it.
  function handleTimeout() {
    reportAlarmState("timedOut");
    stopAlarm();
  }

  // A real button press proves someone's home, whether they stop it
  // outright or just snooze it.
  function handleManualStop() {
    reportAlarmState("acknowledged");
    stopAlarm();
  }

  function snoozeAlarm() {
    reportAlarmState("acknowledged");
    pausePlayback();
    setActive(false);
    snoozeTimerRef.current = setTimeout(() => setActive(true), SNOOZE_MS);
  }

  return (
    <>
      <audio ref={audioRef} loop preload="auto" />
      {active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="flex flex-col items-center gap-[2vh] rounded-2xl border border-surface-border bg-surface p-[4vh]">
            <p className="text-hero-sub">Good morning!</p>
            <div className="flex gap-[2vh]">
              <button
                onClick={handleManualStop}
                className="text-body rounded-xl bg-accent-work px-[3vh] py-[1.5vh] font-medium text-foreground focus:outline-none focus:ring-4 focus:ring-white"
              >
                Stop
              </button>
              <button
                autoFocus
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
