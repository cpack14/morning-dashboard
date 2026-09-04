"use client";

import { useEffect, useRef, useState } from "react";

// Disabled until something in the surrounding form actually changes,
// so a stray tap can't resubmit unchanged settings. Resets itself
// naturally after a save, since the server action's revalidatePath
// causes a fresh render (and therefore a fresh mount) of this button.
export function SaveSettingsButton() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const form = buttonRef.current?.closest("form");
    if (!form) return;

    const markDirty = () => setDirty(true);
    form.addEventListener("input", markDirty);
    form.addEventListener("change", markDirty);
    return () => {
      form.removeEventListener("input", markDirty);
      form.removeEventListener("change", markDirty);
    };
  }, []);

  return (
    <button
      ref={buttonRef}
      type="submit"
      disabled={!dirty}
      className={`rounded-2xl px-6 py-3 text-lg font-medium transition-colors ${
        dirty
          ? "bg-accent-work text-foreground"
          : "cursor-not-allowed bg-surface text-muted"
      }`}
    >
      Save settings
    </button>
  );
}
