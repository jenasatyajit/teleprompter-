"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { COLOR_PRESETS, type Align, type FontId, type Mode } from "@/lib/prompter-options";

export type Settings = {
  mode: Mode;
  // text
  fontFamily: FontId;
  fontSize: number; // px
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number; // em
  align: Align;
  // layout
  textWidth: number; // % of stage
  sideMargin: number; // px
  readingLine: number; // % from top
  showReadingLine: boolean;
  mirrorH: boolean;
  mirrorV: boolean;
  // colors
  textColor: string;
  backgroundColor: string;
  highlightColor: string;
  // behaviour
  speed: number; // words per minute (auto-scroll)
  countdown: number; // seconds before starting
  dimRead: boolean;
  dimOpacity: number;
  highlightLine: boolean;
  // voice mode
  markSkipped: boolean; // underline words you skipped instead of treating them as read
  silenceFallback: boolean; // keep moving at the auto-scroll speed when you go quiet
  silenceSeconds: number;
};

export const DEFAULT_SETTINGS: Settings = {
  mode: "auto",
  fontFamily: "atkinson",
  fontSize: 56,
  fontWeight: 500,
  lineHeight: 1.5,
  letterSpacing: 0,
  align: "left",
  textWidth: 72,
  sideMargin: 24,
  readingLine: 38,
  showReadingLine: true,
  mirrorH: false,
  mirrorV: false,
  textColor: COLOR_PRESETS[0].text,
  backgroundColor: COLOR_PRESETS[0].background,
  highlightColor: COLOR_PRESETS[0].highlight,
  speed: 140,
  countdown: 3,
  dimRead: true,
  dimOpacity: 0.3,
  highlightLine: true,
  markSkipped: true,
  silenceFallback: false,
  silenceSeconds: 5,
};

type SettingsStore = {
  settings: Settings;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  patch: (partial: Partial<Settings>) => void;
  reset: () => void;
};

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      set: (key, value) => set((s) => ({ settings: { ...s.settings, [key]: value } })),
      patch: (partial) => set((s) => ({ settings: { ...s.settings, ...partial } })),
      reset: () => set({ settings: DEFAULT_SETTINGS }),
    }),
    {
      name: "cue:settings",
      version: 1,
      // Merge so new settings added later get defaults for existing users.
      merge: (persisted, current) => ({
        ...current,
        settings: {
          ...DEFAULT_SETTINGS,
          ...((persisted as Partial<SettingsStore> | undefined)?.settings ?? {}),
        },
      }),
      partialize: (s) => ({ settings: s.settings }) as SettingsStore,
    },
  ),
);
