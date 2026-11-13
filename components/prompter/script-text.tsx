"use client";

import { memo, useMemo } from "react";
import type { Paragraph } from "@/lib/script-parse";
import { SKIPPED } from "@/lib/speech/matcher";

type ParagraphProps = {
  paragraph: Paragraph;
  /** Words in this paragraph that are already read. */
  read: number;
  /** Index (within this paragraph) where the active line ends (exclusive). */
  activeEnd: number;
  /** Comma-separated local indices of skipped words (string so memo compares by value). */
  skipped: string;
  dimRead: boolean;
  highlightLine: boolean;
};

const ParagraphView = memo(function ParagraphView({
  paragraph,
  read,
  activeEnd,
  skipped,
  dimRead,
  highlightLine,
}: ParagraphProps) {
  const skippedSet = useMemo(
    () => new Set(skipped ? skipped.split(",").map(Number) : []),
    [skipped],
  );

  if (paragraph.blank) {
    return <div aria-hidden className="h-[0.7em]" />;
  }

  return (
    <p className="m-0 [text-wrap:pretty]">
      {paragraph.words.map((word, i) => {
        const isRead = i < read;
        const isSkipped = isRead && skippedSet.has(i);
        const isActive = !isRead && highlightLine && i < activeEnd;
        return (
          <span key={i}>
            <span
              data-w=""
              data-i={paragraph.start + i}
              data-skipped={isSkipped ? "" : undefined}
              className="prompter-word"
              style={{
                opacity: isSkipped ? 0.7 : isRead && dimRead ? "var(--p-dim)" : 1,
                color: isActive ? "var(--p-hl)" : undefined,
                textDecoration: isSkipped ? "underline wavy var(--p-skip)" : undefined,
                textUnderlineOffset: isSkipped ? "0.18em" : undefined,
                textDecorationThickness: isSkipped ? "0.06em" : undefined,
              }}
            >
              {word}
            </span>{" "}
          </span>
        );
      })}
    </p>
  );
});

type Props = {
  paragraphs: Paragraph[];
  /** Number of words already read (global index of the first unread word). */
  cursor: number;
  /** Global index where the active line ends (exclusive). */
  activeEnd: number;
  /** Voice mode: per-word status from the matcher. */
  status?: Uint8Array | null;
  markSkipped: boolean;
  dimRead: boolean;
  highlightLine: boolean;
};

export function ScriptText({
  paragraphs,
  cursor,
  activeEnd,
  status,
  markSkipped,
  dimRead,
  highlightLine,
}: Props) {
  return (
    <>
      {paragraphs.map((p) => {
        const len = p.words.length;
        const read = Math.min(Math.max(cursor - p.start, 0), len);
        const end = Math.min(Math.max(activeEnd - p.start, read), len);

        let skipped = "";
        if (status && markSkipped && read > 0) {
          const list: number[] = [];
          for (let i = 0; i < read; i++) if (status[p.start + i] === SKIPPED) list.push(i);
          skipped = list.join(",");
        }

        return (
          <ParagraphView
            key={p.key}
            paragraph={p}
            read={read}
            activeEnd={end}
            skipped={skipped}
            dimRead={dimRead}
            highlightLine={highlightLine}
          />
        );
      })}
    </>
  );
}
