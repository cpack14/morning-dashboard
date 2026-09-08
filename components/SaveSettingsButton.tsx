"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

// Disabled until something in the surrounding form actually changes,
// so a stray tap can't resubmit unchanged settings. Also tracks the
// form's own submit status so a save is visibly a "Saving…" then a
// "Saved ✓" moment — without this, a click looked like it did
// nothing at all, since the button's enabled/blue look was otherwise
// identical before and after a successful submit.
export function SaveSettingsButton() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dirty, setDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const { pending } = useFormStatus();
  const wasPendingRef = useRef(false);

  useEffect(() => {
    const form = buttonRef.current?.closest("form");
    if (!form) return;

    const markDirty = () => {
      setDirty(true);
      setJustSaved(false);
    };
    form.addEventListener("input", markDirty);
    form.addEventListener("change", markDirty);
    return () => {
      form.removeEventListener("input", markDirty);
      form.removeEventListener("change", markDirty);
    };
  }, []);

  // Fires once when a submission finishes (pending flips true -> false):
  // clears the dirty flag and shows a brief confirmation.
  useEffect(() => {
    if (wasPendingRef.current && !pending) {
      setDirty(false);
      setJustSaved(true);
      const timer = setTimeout(() => setJustSaved(false), 2500);
      return () => clearTimeout(timer);
    }
    wasPendingRef.current = pending;
  }, [pending]);

  const label = pending ? "Saving…" : justSaved ? "Saved ✓" : "Save settings";

  return (
    <button
      ref={buttonRef}
      type="submit"
      disabled={!dirty || pending}
      className={`rounded-2xl px-6 py-3 text-lg font-medium transition-colors ${
        pending
          ? "cursor-wait bg-surface text-muted"
          : justSaved
            ? "bg-accent-personal text-black"
            : dirty
              ? "bg-accent-work text-foreground"
              : "cursor-not-allowed bg-surface text-muted"
      }`}
    >
      {label}
    </button>
  );
}
