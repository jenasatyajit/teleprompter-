"use client";

import { useCallback, useSyncExternalStore } from "react";

// Bring-your-own-key: the Deepgram API key lives only in this browser's localStorage.
const STORAGE_KEY = "teleprompter:deepgram-key";
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

const getSnapshot = () => window.localStorage.getItem(STORAGE_KEY) ?? "";
const getServerSnapshot = () => "";

export function useDeepgramKey() {
  const key = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setKey = useCallback((value: string) => {
    const trimmed = value.trim();
    if (trimmed) window.localStorage.setItem(STORAGE_KEY, trimmed);
    else window.localStorage.removeItem(STORAGE_KEY);
    listeners.forEach((l) => l());
  }, []);

  return { key, setKey };
}
