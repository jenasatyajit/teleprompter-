import {
  Atkinson_Hyperlegible_Next,
  Fraunces,
  Instrument_Sans,
  JetBrains_Mono,
  Lexend,
  Newsreader,
  Noto_Sans_Devanagari,
} from "next/font/google";

// UI
export const uiFont = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-ui",
});

export const displayFont = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-display-face",
});

export const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-face",
});

// Prompter reading fonts
export const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  variable: "--font-atkinson",
});

export const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
});

export const lexend = Lexend({
  subsets: ["latin"],
  variable: "--font-lexend",
});

// Devanagari fallback so Hindi text renders well in every prompter font.
export const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari", "latin"],
  variable: "--font-devanagari",
});

export const fontVariables = [
  uiFont,
  displayFont,
  monoFont,
  atkinson,
  newsreader,
  lexend,
  devanagari,
]
  .map((f) => f.variable)
  .join(" ");
