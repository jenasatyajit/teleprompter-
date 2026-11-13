export type Paragraph = {
  key: number;
  words: string[];
  /** Index of this paragraph's first word in the whole script. */
  start: number;
  /** True for an empty line (rendered as vertical space). */
  blank: boolean;
};

export type ParsedScript = {
  paragraphs: Paragraph[];
  wordCount: number;
};

/** Splits a script into paragraphs (one per line) and words, keeping punctuation. */
export function parseScript(text: string): ParsedScript {
  const paragraphs: Paragraph[] = [];
  let wordCount = 0;
  let lastBlank = true; // collapse leading/consecutive blank lines

  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    const words = line.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      if (!lastBlank) {
        paragraphs.push({ key: paragraphs.length, words: [], start: wordCount, blank: true });
        lastBlank = true;
      }
      continue;
    }
    paragraphs.push({ key: paragraphs.length, words, start: wordCount, blank: false });
    wordCount += words.length;
    lastBlank = false;
  }

  while (paragraphs.length && paragraphs[paragraphs.length - 1].blank) paragraphs.pop();
  return { paragraphs, wordCount };
}

export function countWords(text: string): number {
  const m = text.trim().match(/\S+/g);
  return m ? m.length : 0;
}

/** Light markdown clean-up for imported .md files. */
export function stripMarkdown(md: string): string {
  return md
    .replace(/\r\n?/g, "\n")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^---+$/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*([-*+]|\d+\.)\s+/gm, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/([*_`])(.*?)\1/g, "$2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}
