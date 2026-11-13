"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type UiStore = {
  /** Desktop script sidebar open / collapsed. */
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
};

export const useUi = create<UiStore>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    }),
    {
      name: "cue:ui",
      version: 1,
      partialize: (s) => ({ sidebarOpen: s.sidebarOpen }) as UiStore,
      // Ignore malformed stored values instead of crashing.
      merge: (persisted, current) => {
        const open = (persisted as Partial<UiStore> | undefined)?.sidebarOpen;
        return { ...current, sidebarOpen: typeof open === "boolean" ? open : current.sidebarOpen };
      },
    },
  ),
);
