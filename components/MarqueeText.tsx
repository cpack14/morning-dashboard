"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const PAUSE_START_MS = 2500;
const PAUSE_END_MS = 1200;
const PX_PER_SEC = 40;
const MIN_SCROLL_MS = 2500;
const MAX_SCROLL_MS = 12000;

// Shows text at full width when it fits. When it doesn't, holds the
// truncated start for a beat, scrolls slowly to reveal the rest, holds
// the end for a beat, then snaps back to the start and repeats.
export function MarqueeText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [distance, setDistance] = useState(0);
  const [phase, setPhase] = useState<"start" | "scrolling">("start");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;

    function measure() {
      const overflow = textEl!.scrollWidth - container!.clientWidth;
      setDistance((prev) => {
        const next = overflow > 1 ? overflow : 0;
        return next === prev ? prev : next;
      });
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [text]);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setPhase("start");
    if (distance <= 0) return;

    timeoutRef.current = setTimeout(() => setPhase("scrolling"), PAUSE_START_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [distance]);

  function handleTransitionEnd() {
    if (phase !== "scrolling") return;
    timeoutRef.current = setTimeout(() => {
      setPhase("start");
      timeoutRef.current = setTimeout(() => setPhase("scrolling"), PAUSE_START_MS);
    }, PAUSE_END_MS);
  }

  const scrollMs = Math.min(
    MAX_SCROLL_MS,
    Math.max(MIN_SCROLL_MS, (distance / PX_PER_SEC) * 1000),
  );

  return (
    <div ref={containerRef} className={`overflow-hidden ${className}`}>
      <span
        ref={textRef}
        onTransitionEnd={handleTransitionEnd}
        className="inline-block whitespace-nowrap"
        style={
          distance > 0
            ? {
                transform: `translateX(${phase === "scrolling" ? -distance : 0}px)`,
                transition:
                  phase === "scrolling" ? `transform ${scrollMs}ms linear` : "none",
              }
            : undefined
        }
      >
        {text}
      </span>
    </div>
  );
}
