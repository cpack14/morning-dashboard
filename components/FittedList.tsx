"use client";

import { useLayoutEffect, useRef, useState, type ReactElement } from "react";

const MIN_SCALE = 0.6;
const SCALE_STEP = 0.05;

// Shrinks font size to fit as many list items as possible, then hides
// whatever's left from the bottom and shows a "+N more" line rather
// than silently cutting off the last visible item. `items` must each
// be a keyed <li> element.
export function FittedList({ items }: { items: ReactElement[] }) {
  const listRef = useRef<HTMLUListElement>(null);
  const [scale, setScale] = useState(1);
  const [hiddenCount, setHiddenCount] = useState(0);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const children = Array.from(list.children) as HTMLElement[];
    children.forEach((li) => {
      li.style.display = "";
    });

    let currentScale = 1;
    list.style.setProperty("--fit-scale", "1");
    const fits = () => list.scrollHeight <= list.clientHeight + 1;

    while (!fits() && currentScale > MIN_SCALE) {
      currentScale = Math.max(MIN_SCALE, currentScale - SCALE_STEP);
      list.style.setProperty("--fit-scale", String(currentScale));
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
  }, [items]);

  return (
    <div className="flex h-full min-h-0 flex-col">
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
