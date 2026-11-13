export type FontId = "atkinson" | "newsreader" | "lexend" | "ui" | "mono";

export const PROMPTER_FONTS: { id: FontId; label: string; stack: string }[] = [
  {
    id: "atkinson",
    label: "Atkinson Hyperlegible",
    stack: "var(--font-atkinson), var(--font-devanagari), system-ui, sans-serif",
  },
  {
    id: "newsreader",
    label: "Newsreader (serif)",
    stack: "var(--font-newsreader), var(--font-devanagari), Georgia, serif",
  },
  {
    id: "lexend",
    label: "Lexend",
    stack: "var(--font-lexend), var(--font-devanagari), system-ui, sans-serif",
  },
  {
    id: "ui",
    label: "Instrument Sans",
    stack: "var(--font-ui), var(--font-devanagari), system-ui, sans-serif",
  },
  {
    id: "mono",
    label: "JetBrains Mono",
    stack: "var(--font-mono-face), var(--font-devanagari), ui-monospace, monospace",
  },
];

export const fontStack = (id: FontId) =>
  (PROMPTER_FONTS.find((f) => f.id === id) ?? PROMPTER_FONTS[0]).stack;

export type ColorPreset = {
  id: string;
  label: string;
  text: string;
  background: string;
  highlight: string;
};

export const COLOR_PRESETS: ColorPreset[] = [
  { id: "ink", label: "Ink", text: "#f3efe6", background: "#0f0e0c", highlight: "#ffc247" },
  { id: "paper", label: "Paper", text: "#1d1b17", background: "#f6f1e6", highlight: "#b45309" },
  { id: "contrast", label: "Contrast", text: "#ffffff", background: "#000000", highlight: "#ffe600" },
  { id: "forest", label: "Forest", text: "#e4efe2", background: "#0e1a14", highlight: "#7ee0a0" },
];

export type Align = "left" | "center" | "right" | "justify";
export type Mode = "voice" | "auto" | "manual";
export type Language = "en" | "hi" | "hinglish";

export const LANGUAGES: { id: Language; label: string }[] = [
  { id: "en", label: "English" },
  { id: "hi", label: "Hindi" },
  { id: "hinglish", label: "Hinglish" },
];
