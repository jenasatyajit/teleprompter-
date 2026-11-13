"use client";

import { useSyncExternalStore } from "react";

export function useMediaQuery(query: string, serverFallback = false) {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => serverFallback,
  );
}

const noop = () => () => {};
/** True only after hydration, so persisted client state never mismatches SSR markup. */
export function useMounted() {
  return useSyncExternalStore(noop, () => true, () => false);
}
