"use client";

import { useEffect, useRef, useState } from "react";

const RAMP_DURATION_MS = 30_000;
const MAX_PLAY_DURATION_MS = 3 * 60 * 1000;
const MIN_VOLUME = 0.03;
const MAX_VOLUME = 1.0;

// Renders an always-present, silent <audio> element. If the page loads
// with ?alarm=1 in the URL (Frank triggers this via Fully Kiosk's
// loadUrl API at the computed wake time), it plays a gentle chime that
// ramps up in volume over 30s, stoppable by any remote button press,
// and auto-stops after 3 minutes as a safety net either way.
export function AlarmController() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("alarm") !== "1") return;

    setActive(true);

    // Strip the flag so a later manual refresh doesn't replay it.
    const url = new URL(window.location.href);
    url.searchParams.delete("alarm");
    window.history.replaceState({}, "", url.toString());
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
