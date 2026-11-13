"use client";

import { useEffect, useRef, type RefObject } from "react";
import { Mic, MicOff } from "lucide-react";
import type { StreamStatus } from "@/hooks/use-deepgram-stream";
import { cn } from "@/lib/utils";

/** Animated mic level bars, driven by a ref so the parent never re-renders. */
function MicMeter({ levelRef, active }: { levelRef: RefObject<number>; active: boolean }) {
  const bars = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => {
      const level = levelRef.current ?? 0;
      bars.current.forEach((el, i) => {
        if (!el) return;
        const scale = Math.max(0.18, Math.min(1, level * (0.6 + i * 0.25)));
        el.style.transform = `scaleY(${scale})`;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, levelRef]);

  return (
    <span aria-hidden className="flex h-4 items-center gap-[2px]">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          ref={(el) => {
            bars.current[i] = el;
          }}
          className="h-full w-[3px] origin-center rounded-full bg-current transition-transform duration-75"
          style={{ transform: "scaleY(0.18)" }}
        />
      ))}
    </span>
  );
}

type Props = {
  status: StreamStatus;
  error: string | null;
  heard: string;
  levelRef: RefObject<number>;
  onOpenSettings: () => void;
  className?: string;
};

export function VoiceStatus({ status, error, heard, levelRef, onOpenSettings, className }: Props) {
  if (error) {
    return (
      <div
        role="alert"
        className={cn(
          "flex max-w-[min(32rem,90%)] items-start gap-2 rounded-xl border border-destructive/40 bg-card/90 px-3 py-2 text-sm text-destructive shadow-lg backdrop-blur",
          className,
        )}
      >
        <MicOff className="mt-0.5 size-4 shrink-0" />
        <span className="min-w-0">
          {error}{" "}
          <button type="button" onClick={onOpenSettings} className="underline underline-offset-2">
            Open settings
          </button>
        </span>
      </div>
    );
  }

  if (status === "idle") return null;

  const listening = status === "listening";
  return (
    <div
      className={cn(
        "pointer-events-none flex max-w-[min(26rem,70%)] items-center gap-2 rounded-full border bg-card/80 px-3 py-1.5 text-xs text-card-foreground shadow backdrop-blur",
        listening ? "text-primary" : "text-muted-foreground",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {listening ? <MicMeter levelRef={levelRef} active /> : <Mic className="size-3.5 animate-pulse" />}
      <span className="truncate text-card-foreground/80">
        {listening ? heard || "Listening…" : "Connecting…"}
      </span>
    </div>
  );
}
