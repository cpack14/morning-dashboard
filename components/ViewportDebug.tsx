"use client";

import { useEffect, useState } from "react";

export function ViewportDebug() {
  const [size, setSize] = useState("");

  useEffect(() => {
    const update = () =>
      setSize(`${window.innerWidth}x${window.innerHeight} dpr:${window.devicePixelRatio}`);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div className="fixed bottom-1 right-1 z-50 rounded bg-black/60 px-2 py-1 text-[10px] text-white/70">
      {size}
    </div>
  );
}
