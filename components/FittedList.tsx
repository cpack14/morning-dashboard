"use client";

import { useLayoutEffect, useRef, useState, type ReactElement } from "react";

const MIN_SCALE = 0.6;
const SCALE_STEP = 0.05;

// Shrinks font size to fit as many list items as possible, then hides
// whatever's left from the bottom and shows a "+N more" line rather
// than silently cutting off the last visible item. `items` must each
// be a keyed <li> element.
export function FittedList({ items }: { items: ReactElement[] }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [scale, setScale] = useState(1);
  const [hiddenCount, setHiddenCount] = useState(0);

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const list = listRef.current;
    if (!wrapper || !list) return;

    function measure() {
      const children = Array.from(list!.children) as HTMLElement[];
      children.forEach((li) => {
        li.style.display = "";
      });

      // Set the real font-size imperatively (not just a CSS var no
      // rule reads) so each fits() check below reflects text that has
      // actually shrunk, rather than repeatedly checking the same
      // unchanged rendered size and bottoming out at MIN_SCALE.
      let currentScale = 1;
      const applyScale = (s: number) => {
        list!.style.fontSize = `calc(var(--text-body) * ${s})`;
      };
      applyScale(currentScale);
      const fits = () => list!.scrollHeight <= list!.clientHeight + 1;

      while (!fits() && currentScale > MIN_SCALE) {
        currentScale = Math.max(MIN_SCALE, currentScale - SCALE_STEP);
        applyScale(currentScale);
      }

      let currentHidden = 0;
      if (!fits()) {
        for (let hideFrom = children.length - 1; hideFrom >= 0; hideFrom--) {
          for (let i = hideFrom; i < children.length; i++) {
            children[i].style.display = "none";
          }
          currentHidden = children.length - hideFrom;
          if (fits()) break;
        }
      }

      setScale(currentScale);
      setHiddenCount(currentHidden);
    }

    // Measure immediately, but also re-measure once web fonts finish
    // loading and whenever the card's own size actually changes — a
    // measurement taken against fallback-font metrics (common on the
    // TV's WebView) can under-count how much actually fits.
    measure();
    document.fonts?.ready?.then(measure);

    const observer = new ResizeObserver(measure);
    observer.observe(wrapper);

    // Belt-and-suspenders: a poll can swap in a longer items array at
    // a moment where this measurement races the new content's layout
    // (observed in practice — items grew from 6 to 8 and the list
    // silently overflowed with no shrink/hide applied). Re-validating
    // periodically self-heals regardless of what caused a miss.
    const interval = setInterval(measure, 4000);

    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, [items]);

  return (
    <div ref={wrapperRef} className="flex h-full min-h-0 flex-col">
      <ul
        ref={listRef}
        className="min-h-0 flex-1 space-y-[0.4em] overflow-hidden"
        style={{ fontSize: `calc(var(--text-body) * ${scale})` }}
      >
        {items}
      </ul>
      <p
        className={`text-label mt-[0.3em] shrink-0 text-muted ${hiddenCount > 0 ? "" : "invisible"}`}
      >
        +{hiddenCount || 1} more
      </p>
    </div>
  );
}
