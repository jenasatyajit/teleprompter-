"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Language } from "@/lib/prompter-options";

export const SAMPLE_SCRIPT = `Welcome back to the channel. Today I want to show you how a good teleprompter should feel.

It should stay out of your way. The words move when you need them, and wait when you pause.

Take a breath. Look straight into the lens. Read at a pace that feels like a conversation, not a recital.

When you are ready, press play, and let the script do the heavy lifting.`;

export type Script = {
  id: string;
  title: string;
  text: string;
  language: Language;
  updatedAt: number;
};

type NewScript = Partial<Pick<Script, "title" | "text" | "language">>;

type LibraryStore = {
  scripts: Script[];
  activeId: string;
  create: (initial?: NewScript) => string;
  duplicate: (id: string) => void;
  remove: (id: string) => void;
  select: (id: string) => void;
  update: (id: string, patch: Partial<Pick<Script, "title" | "text" | "language">>) => void;
};

const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `s_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

function makeScript(initial: NewScript = {}): Script {
  return {
    id: makeId(),
    title: initial.title ?? "Untitled script",
    text: initial.text ?? "",
    language: initial.language ?? "en",
    updatedAt: Date.now(),
  };
}

const first = makeScript({ text: SAMPLE_SCRIPT });

export const useLibrary = create<LibraryStore>()(
  persist(
    (set, get) => ({
      scripts: [first],
      activeId: first.id,

      create: (initial) => {
        const script = makeScript(initial);
        set((s) => ({ scripts: [script, ...s.scripts], activeId: script.id }));
        return script.id;
      },

      duplicate: (id) => {
        const src = get().scripts.find((s) => s.id === id);
        if (!src) return;
        const copy = makeScript({
          title: `${src.title} (copy)`,
          text: src.text,
          language: src.language,
        });
        set((s) => ({ scripts: [copy, ...s.scripts], activeId: copy.id }));
      },

      remove: (id) =>
        set((s) => {
          const scripts = s.scripts.filter((x) => x.id !== id);
          // The library always holds at least one script.
          if (scripts.length === 0) {
            const fresh = makeScript();
            return { scripts: [fresh], activeId: fresh.id };
          }
          const activeId = s.activeId === id ? scripts[0].id : s.activeId;
          return { scripts, activeId };
        }),

      select: (id) => {
        if (get().scripts.some((s) => s.id === id)) set({ activeId: id });
      },

      update: (id, patch) =>
        set((s) => ({
          scripts: s.scripts.map((x) =>
            x.id === id ? { ...x, ...patch, updatedAt: Date.now() } : x,
          ),
        })),
    }),
    {
      name: "cue:script",
      version: 2,
      // v1 stored a single script as { title, text, language } — carry it over.
      migrate: (persisted, version) => {
        if (version < 2) {
          const old = (persisted ?? {}) as Partial<Pick<Script, "title" | "text" | "language">>;
          const migrated = makeScript({
            title: old.title,
            text: old.text ?? SAMPLE_SCRIPT,
            language: old.language,
          });
          return { scripts: [migrated], activeId: migrated.id } as LibraryStore;
        }
        return persisted as LibraryStore;
      },
      partialize: (s) => ({ scripts: s.scripts, activeId: s.activeId }) as LibraryStore,
    },
  ),
);

/** The currently selected script plus setters that act on it. */
export function useActiveScript() {
  const scripts = useLibrary((s) => s.scripts);
  const activeId = useLibrary((s) => s.activeId);
  const update = useLibrary((s) => s.update);
  const script = scripts.find((s) => s.id === activeId) ?? scripts[0];

  return {
    script,
    setTitle: (title: string) => update(script.id, { title }),
    setText: (text: string) => update(script.id, { text }),
    setLanguage: (language: Language) => update(script.id, { language }),
  };
}
