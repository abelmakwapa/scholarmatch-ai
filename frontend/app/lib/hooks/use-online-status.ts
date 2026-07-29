"use client";

import { useEffect, useState } from "react";

/**
 * Tracks browser connectivity. Starts optimistic (`true`) so server rendering
 * and the first paint never flash an offline warning, then syncs to the real
 * value after mount and on `online`/`offline` events.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
}
