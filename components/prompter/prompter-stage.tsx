"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  FlipHorizontal2,
  Maximize,
  Minimize,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { IconButton } from "@/components/icon-button";
import { ScriptText } from "@/components/prompter/script-text";
import { VoiceStatus } from "@/components/prompter/voice-status";
import { Button } from "@/components/ui/button";
import { useDeepgramStream } from "@/hooks/use-deepgram-stream";
import { useDeepgramKey } from "@/lib/deepgram-key";
import { fontStack } from "@/lib/prompter-options";
import { formatDuration, parseScript } from "@/lib/script-parse";
import { useActiveScript } from "@/lib/script-store";
import { useSettings } from "@/lib/settings-store";
import { ScriptMatcher } from "@/lib/speech/matcher";
import { cn } from "@/lib/utils";

type Props = {
  onExit: () => void;
  onToggleSettings: () => void;
  settingsOpen: boolean;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const READING_LINE_MIN = 10;
const READING_LINE_MAX = 80;

export function PrompterStage({ onExit, onToggleSettings, settingsOpen }: Props) {
  const s = useSettings((st) => st.settings);
  const setSetting = useSettings((st) => st.set);
  const { script } = useActiveScript();
  const { key: apiKey } = useDeepgramKey();

  const parsed = useMemo(() => parseScript(script.text), [script.text]);
  const matcher = useMemo(
    () =>
      new ScriptMatcher(
        parsed.paragraphs.flatMap((p) => p.words),
        script.language,
      ),
    [parsed, script.language],
  );
  const isVoice = s.mode === "voice";

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Layout measurements (word midpoints / line tops, relative to the scroll content).
  const topsRef = useRef<number[]>([]);
  const lineTopsRef = useRef<number[]>([]);
  const pxPerWordRef = useRef(1);

  // Scroll engine state.
  const posRef = useRef(0);
  const lastSetRef = useRef(0);
  const startedRef = useRef(false);
  const speedRef = useRef(s.speed);
  const readingLineRef = useRef(s.readingLine);
  const lastSpeechRef = useRef(0);
  const userScrollUntilRef = useRef(0);
  const endRef = useRef<() => void>(() => {});

  // Scroll-derived cursor (auto / manual modes).
  const [cursor, setCursor] = useState(0);
  const [activeEnd, setActiveEnd] = useState(0);
  // Voice-derived cursor lives in the matcher; these just trigger renders.
  const [, setVoiceTick] = useState(0);
  const [voiceActive, setVoiceActive] = useState(0);
  const [heard, setHeard] = useState("");

  const [playing, setPlaying] = useState(false);
  const [countdownLeft, setCountdownLeft] = useState<number | null>(null);
  const [viewportH, setViewportH] = useState(0);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    speedRef.current = s.speed;
    readingLineRef.current = s.readingLine;
  }, [s.speed, s.readingLine]);

  // ---- layout helpers ----------------------------------------------------
  /** Global index where the visual line containing word `idx` ends (exclusive). */
  const activeEndFor = useCallback((idx: number) => {
    const lines = lineTopsRef.current;
    if (idx >= lines.length) return lines.length;
    const lineTop = lines[idx];
    let end = idx;
    while (end < lines.length && lines[end] === lineTop) end++;
    return end;
  }, []);

  const syncVoice = useCallback(() => {
    setVoiceTick(matcher.version);
    setVoiceActive(activeEndFor(matcher.cursor));
  }, [matcher, activeEndFor]);

  const updateCursor = useCallback(() => {
    const el = scrollRef.current;
    const tops = topsRef.current;
    if (!el || tops.length === 0) {
      setCursor(0);
      setActiveEnd(0);
      return;
    }
    const y = el.scrollTop + (el.clientHeight * s.readingLine) / 100;
    let lo = 0;
    let hi = tops.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tops[mid] < y) lo = mid + 1;
      else hi = mid;
    }
    setCursor(lo);
    setActiveEnd(activeEndFor(lo));
  }, [s.readingLine, activeEndFor]);

  const measure = useCallback(() => {
    const root = contentRef.current;
    if (!root) return;
    const els = root.querySelectorAll<HTMLElement>("[data-w]");
    const tops: number[] = new Array(els.length);
    const lines: number[] = new Array(els.length);
    els.forEach((el, i) => {
      tops[i] = el.offsetTop + el.offsetHeight / 2;
      lines[i] = el.offsetTop;
    });
    topsRef.current = tops;
    lineTopsRef.current = lines;
    if (els.length > 0) {
      const lineHeightPx = s.fontSize * s.lineHeight;
      const span = lines[els.length - 1] - lines[0] + lineHeightPx;
      pxPerWordRef.current = Math.max(1, span / els.length);
    }
    if (isVoice) setVoiceActive(activeEndFor(matcher.cursor));
    else updateCursor();
  }, [s.fontSize, s.lineHeight, isVoice, matcher, activeEndFor, updateCursor]);

  // Re-measure after any change that affects layout (deferred a frame, once the DOM has settled).
  useEffect(() => {
    const id = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(id);
  }, [
    measure,
    parsed,
    viewportH,
    s.fontFamily,
    s.fontSize,
    s.fontWeight,
    s.lineHeight,
    s.letterSpacing,
    s.align,
    s.textWidth,
    s.sideMargin,
    s.readingLine,
  ]);

  useEffect(() => {
    const scroller = scrollRef.current;
    const content = contentRef.current;
    if (!scroller || !content) return;
    // Resizes come in bursts (e.g. every frame while the settings panel slides open), so
    // re-measure once the size settles instead of reading every word's position per frame.
    let settle = 0;
    const ro = new ResizeObserver(() => {
      setViewportH(scroller.clientHeight);
      window.clearTimeout(settle);
      settle = window.setTimeout(measure, 90);
    });
    ro.observe(scroller);
    ro.observe(content);
    // Web fonts change glyph metrics after load.
    void document.fonts?.ready.then(measure);
    return () => {
      window.clearTimeout(settle);
      ro.disconnect();
    };
  }, [measure]);

  // ---- voice -------------------------------------------------------------
  const handleResult = useCallback(
    (text: string, isFinal: boolean) => {
      if (text.trim()) {
        lastSpeechRef.current = performance.now();
        setHeard(text);
      }
      if (matcher.feed(text, isFinal)) syncVoice();
      if (isFinal && matcher.cursor >= matcher.length) endRef.current();
    },
    [matcher, syncVoice],
  );

  const {
    status: voiceStatus,
    error: voiceError,
    levelRef,
    start: startVoice,
    stop: stopVoice,
  } = useDeepgramStream({ apiKey, language: script.language, onResult: handleResult });

  // A failed connection should not leave the play button stuck on "pause".
  const running = isVoice ? playing && voiceStatus !== "error" : playing;

  // Follow the matcher cursor: ease the reading line toward the next word to read.
  useEffect(() => {
    if (!isVoice) return;
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const el = scrollRef.current;
      if (!el) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      const tops = topsRef.current;
      if (tops.length > 0 && now > userScrollUntilRef.current) {
        if (Math.abs(el.scrollTop - lastSetRef.current) > 2) posRef.current = el.scrollTop;
        const idx = Math.min(matcher.cursor, tops.length - 1);
        const max = el.scrollHeight - el.clientHeight;
        const target = clamp(tops[idx] - (el.clientHeight * readingLineRef.current) / 100, 0, max);
        const diff = target - posRef.current;
        posRef.current = Math.abs(diff) < 0.5 ? target : posRef.current + diff * Math.min(1, dt * 6);
        el.scrollTop = posRef.current;
        lastSetRef.current = el.scrollTop;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isVoice, matcher]);

  // Optional: keep moving at the auto-scroll speed while the speaker is silent.
  useEffect(() => {
    if (!isVoice || !running || !s.silenceFallback || countdownLeft !== null) return;
    const TICK = 200;
    let accum = 0;
    const id = window.setInterval(() => {
      if (performance.now() - lastSpeechRef.current < s.silenceSeconds * 1000) {
        accum = 0;
        return;
      }
      accum += TICK / 1000;
      const perWord = 60 / (speedRef.current * 0.8);
      let moved = false;
      while (accum >= perWord) {
        accum -= perWord;
        matcher.advance(1);
        moved = true;
      }
      if (moved) {
        syncVoice();
        if (matcher.cursor >= matcher.length) endRef.current();
      }
    }, TICK);
    return () => window.clearInterval(id);
  }, [isVoice, running, s.silenceFallback, s.silenceSeconds, countdownLeft, matcher, syncVoice]);

  // ---- scrolling ---------------------------------------------------------
  const pause = useCallback(() => {
    setPlaying(false);
    if (isVoice) {
      stopVoice();
      matcher.commit();
    }
  }, [isVoice, stopVoice, matcher]);

  useEffect(() => {
    endRef.current = () => {
      startedRef.current = false;
      pause();
    };
  }, [pause]);

  const restart = useCallback(() => {
    const el = scrollRef.current;
    pause();
    setCountdownLeft(null);
    startedRef.current = false;
    if (isVoice) {
      matcher.reset(0);
      setHeard("");
      syncVoice();
    }
    if (el) {
      el.scrollTop = 0;
      posRef.current = 0;
      lastSetRef.current = 0;
    }
    if (!isVoice) updateCursor();
  }, [pause, isVoice, matcher, syncVoice, updateCursor]);

  // Auto-scroll engine.
  useEffect(() => {
    if (!playing || isVoice) return;
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const el = scrollRef.current;
      if (!el) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      // The user wheeled / dragged: adopt their position.
      if (Math.abs(el.scrollTop - lastSetRef.current) > 1.5) posRef.current = el.scrollTop;

      const pxPerSec = (speedRef.current / 60) * pxPerWordRef.current;
      posRef.current += pxPerSec * dt;

      const max = el.scrollHeight - el.clientHeight;
      if (posRef.current >= max) {
        el.scrollTop = max;
        lastSetRef.current = el.scrollTop;
        startedRef.current = false;
        setPlaying(false);
        return;
      }
      el.scrollTop = posRef.current;
      lastSetRef.current = el.scrollTop;
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, isVoice]);

  const begin = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    startedRef.current = true;

    if (isVoice) {
      if (matcher.cursor >= matcher.length) {
        matcher.reset(0);
        syncVoice();
      }
      lastSpeechRef.current = performance.now();
      userScrollUntilRef.current = 0;
      setPlaying(true);
      void startVoice();
      return;
    }

    if (el.scrollTop >= el.scrollHeight - el.clientHeight - 1) el.scrollTop = 0;
    posRef.current = el.scrollTop;
    lastSetRef.current = el.scrollTop;
    setPlaying(true);
  }, [isVoice, matcher, syncVoice, startVoice]);

  const toggle = useCallback(() => {
    if (s.mode === "manual") return;
    if (countdownLeft !== null) {
      setCountdownLeft(null);
      startedRef.current = false;
      return;
    }
    if (running) {
      pause();
      return;
    }
    if (!startedRef.current && s.countdown > 0) {
      startedRef.current = true;
      setCountdownLeft(s.countdown);
      return;
    }
    begin();
  }, [s.mode, s.countdown, countdownLeft, running, pause, begin]);

  // Countdown ticking.
  useEffect(() => {
    if (countdownLeft === null) return;
    const t = window.setTimeout(() => {
      if (countdownLeft <= 1) {
        setCountdownLeft(null);
        begin();
      } else {
        setCountdownLeft(countdownLeft - 1);
      }
    }, 1000);
    return () => window.clearTimeout(t);
  }, [countdownLeft, begin]);

  // Double-click a word to jump there.
  const jumpTo = useCallback(
    (index: number) => {
      const el = scrollRef.current;
      const tops = topsRef.current;
      if (!el || index < 0 || index >= tops.length) return;
      if (isVoice) {
        matcher.reset(index);
        userScrollUntilRef.current = 0;
        syncVoice();
        return;
      }
      const max = el.scrollHeight - el.clientHeight;
      el.scrollTop = clamp(tops[index] - (el.clientHeight * s.readingLine) / 100, 0, max);
      posRef.current = el.scrollTop;
      lastSetRef.current = el.scrollTop;
      updateCursor();
    },
    [isVoice, matcher, syncVoice, s.readingLine, updateCursor],
  );

  // ---- chrome auto-hide --------------------------------------------------
  const bump = useCallback(() => setChromeVisible(true), []);

  useEffect(() => {
    if (!running || !chromeVisible || settingsOpen) return;
    const t = window.setTimeout(() => setChromeVisible(false), 2600);
    return () => window.clearTimeout(t);
  }, [running, chromeVisible, settingsOpen]);

  // ---- fullscreen --------------------------------------------------------
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  }, []);

  // ---- reading line position --------------------------------------------
  const layerRef = useRef<HTMLDivElement>(null);
  const [draggingLine, setDraggingLine] = useState(false);

  const lineFromPointer = useCallback(
    (clientY: number) => {
      const rect = layerRef.current?.getBoundingClientRect();
      if (!rect || rect.height === 0) return;
      let pct = ((clientY - rect.top) / rect.height) * 100;
      if (s.mirrorV) pct = 100 - pct; // the layer is flipped, so measure from the other edge
      setSetting("readingLine", clamp(Math.round(pct), READING_LINE_MIN, READING_LINE_MAX));
    },
    [s.mirrorV, setSetting],
  );

  const onLinePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggingLine(true);
  };
  const onLinePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (draggingLine) lineFromPointer(e.clientY);
  };
  const onLinePointerEnd = (e: React.PointerEvent<HTMLElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setDraggingLine(false);
  };
  const onLineKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    e.stopPropagation(); // don't also trigger the speed / scroll hotkeys
    const dir = (e.key === "ArrowUp" ? -1 : 1) * (s.mirrorV ? -1 : 1);
    const step = e.shiftKey ? 5 : 1;
    setSetting("readingLine", clamp(s.readingLine + dir * step, READING_LINE_MIN, READING_LINE_MAX));
  };

  // ---- hotkeys -----------------------------------------------------------
  const hasSpeed = s.mode === "auto" || (isVoice && s.silenceFallback);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        t.closest(
          "input, textarea, select, [contenteditable='true'], [role='dialog'], [role='listbox'], [role='menu'], [data-settings-panel]",
        )
      ) {
        return;
      }
      const el = scrollRef.current;
      const step = s.fontSize * s.lineHeight;
      let handled = true;

      switch (e.key) {
        case " ":
          if (t?.closest("button")) return; // keep native button activation
          toggle();
          break;
        case "ArrowUp":
          if (hasSpeed) setSetting("speed", clamp(s.speed + 5, 40, 300));
          else if (s.mode === "manual") el?.scrollBy({ top: -step });
          break;
        case "ArrowDown":
          if (hasSpeed) setSetting("speed", clamp(s.speed - 5, 40, 300));
          else if (s.mode === "manual") el?.scrollBy({ top: step });
          break;
        case "PageUp":
          el?.scrollBy({ top: -el.clientHeight * 0.8 });
          break;
        case "PageDown":
          el?.scrollBy({ top: el.clientHeight * 0.8 });
          break;
        case "Home":
          restart();
          break;
        case "Escape":
          if (!document.fullscreenElement) onExit();
          break;
        case "m":
        case "M":
          setSetting("mirrorH", !s.mirrorH);
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
        case "s":
        case "S":
          onToggleSettings();
          break;
        case "+":
        case "=":
          setSetting("fontSize", clamp(s.fontSize + 4, 20, 160));
          break;
        case "-":
        case "_":
          setSetting("fontSize", clamp(s.fontSize - 4, 20, 160));
          break;
        case "[":
          setSetting("readingLine", clamp(s.readingLine - 2, READING_LINE_MIN, READING_LINE_MAX));
          break;
        case "]":
          setSetting("readingLine", clamp(s.readingLine + 2, READING_LINE_MIN, READING_LINE_MAX));
          break;
        default:
          handled = false;
      }
      if (handled) {
        e.preventDefault();
        bump();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s, hasSpeed, toggle, restart, onExit, onToggleSettings, toggleFullscreen, setSetting, bump]);

  // ---- derived ----------------------------------------------------------
  const shownCursor = isVoice ? matcher.cursor : cursor;
  const shownActiveEnd = isVoice ? voiceActive : activeEnd;
  const total = parsed.wordCount;
  const progress = total > 0 ? Math.min(1, shownCursor / total) : 0;
  const remaining = formatDuration(((total - shownCursor) / s.speed) * 60);
  const transform = `${s.mirrorH ? "scaleX(-1)" : ""} ${s.mirrorV ? "scaleY(-1)" : ""}`.trim() || undefined;
  const hideChrome = running && !chromeVisible && !settingsOpen;
  const canPlay = s.mode !== "manual";
  const showPause = running || countdownLeft !== null;

  const stageStyle = {
    background: s.backgroundColor,
    color: s.textColor,
    "--p-hl": s.highlightColor,
    "--p-dim": s.dimOpacity,
    "--p-skip": "#ff7a59",
    cursor: hideChrome ? "none" : undefined,
  } as React.CSSProperties;

  return (
    <div
      className="relative flex-1 overflow-hidden"
      style={stageStyle}
      onPointerMove={bump}
      onPointerDown={bump}
    >
      {/* Mirrorable layer: text, fades and reading line */}
      <div ref={layerRef} className="absolute inset-0" style={{ transform }}>
        <div
          ref={scrollRef}
          className="prompter-scroll h-full overflow-y-auto"
          onScroll={isVoice ? undefined : updateCursor}
          onWheel={() => {
            userScrollUntilRef.current = performance.now() + 2000;
          }}
          onTouchMove={() => {
            userScrollUntilRef.current = performance.now() + 2000;
          }}
          tabIndex={-1}
        >
          <div className="relative">
            <div aria-hidden style={{ height: (viewportH * s.readingLine) / 100 }} />
            <div
              ref={contentRef}
              className="mx-auto"
              onDoubleClick={(e) => {
                const word = (e.target as HTMLElement).closest<HTMLElement>("[data-i]");
                if (word) jumpTo(Number(word.dataset.i));
              }}
              style={{
                width: `${s.textWidth}%`,
                maxWidth: "100%",
                paddingInline: s.sideMargin,
                fontFamily: fontStack(s.fontFamily),
                fontSize: s.fontSize,
                fontWeight: s.fontWeight,
                lineHeight: s.lineHeight,
                letterSpacing: `${s.letterSpacing}em`,
                textAlign: s.align,
              }}
            >
              {parsed.wordCount === 0 ? (
                <p className="opacity-50">Your script is empty. Add some text in the editor.</p>
              ) : (
                <ScriptText
                  paragraphs={parsed.paragraphs}
                  cursor={shownCursor}
                  activeEnd={shownActiveEnd}
                  status={isVoice ? matcher.status : null}
                  markSkipped={s.markSkipped}
                  dimRead={s.dimRead}
                  highlightLine={s.highlightLine}
                />
              )}
            </div>
            <div aria-hidden style={{ height: (viewportH * (100 - s.readingLine)) / 100 }} />
          </div>
        </div>

        {/* Edge fades */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[12%]"
          style={{ background: `linear-gradient(to bottom, ${s.backgroundColor}, transparent)` }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[12%]"
          style={{ background: `linear-gradient(to top, ${s.backgroundColor}, transparent)` }}
        />

        {/* Reading line: drag the arrow on the left (or focus it and use ↑ ↓) to move it */}
        {s.showReadingLine && (
          <div
            className="pointer-events-none absolute inset-x-0 flex -translate-y-1/2 items-center"
            style={{ top: `${s.readingLine}%`, color: s.highlightColor }}
          >
            <span
              role="slider"
              tabIndex={0}
              aria-label="Reading line position"
              aria-orientation="vertical"
              aria-valuemin={READING_LINE_MIN}
              aria-valuemax={READING_LINE_MAX}
              aria-valuenow={s.readingLine}
              aria-valuetext={`${s.readingLine}% from the top`}
              title="Drag to move the reading line"
              onPointerDown={onLinePointerDown}
              onPointerMove={onLinePointerMove}
              onPointerUp={onLinePointerEnd}
              onPointerCancel={onLinePointerEnd}
              onKeyDown={onLineKeyDown}
              className={cn(
                "pointer-events-auto relative -ml-1 flex h-11 w-10 shrink-0 cursor-ns-resize touch-none items-center justify-center rounded-md outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-current",
                hideChrome && !draggingLine && "pointer-events-none opacity-0",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "h-0 w-0 border-y-[7px] border-l-[10px] border-y-transparent border-l-current transition-transform",
                  draggingLine ? "scale-125 opacity-100" : "opacity-80",
                )}
              />
              {draggingLine && (
                <span
                  aria-hidden
                  className="absolute left-10 rounded bg-current px-1.5 py-0.5 font-mono text-[11px] leading-none"
                >
                  <span style={{ color: s.backgroundColor }}>{s.readingLine}%</span>
                </span>
              )}
            </span>
            <span aria-hidden className="mx-2 h-px flex-1 bg-current opacity-25" />
            <span
              aria-hidden
              className="mr-1 h-0 w-0 border-y-[7px] border-r-[10px] border-y-transparent border-r-current opacity-80"
            />
          </div>
        )}
      </div>

      {/* Progress */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-0.5"
        style={{ background: "color-mix(in oklab, currentColor 10%, transparent)" }}
      >
        <div
          className="h-full transition-[width] duration-200"
          style={{ width: `${progress * 100}%`, background: s.highlightColor }}
        />
      </div>

      {/* Stats */}
      <div
        className={cn(
          "pointer-events-none absolute left-4 top-3 font-mono text-xs tabular-nums opacity-60 transition-opacity duration-300",
          hideChrome && "opacity-0",
        )}
        aria-hidden
      >
        {Math.round(progress * 100)}% · {remaining} left
      </div>

      {/* Voice status */}
      {isVoice && (
        <div
          className={cn(
            "absolute z-20 transition-opacity duration-300",
            voiceError ? "left-1/2 top-12 -translate-x-1/2" : "right-4 top-3",
            hideChrome && !voiceError && "opacity-0",
          )}
        >
          <VoiceStatus
            status={running ? voiceStatus : "idle"}
            error={voiceError}
            heard={heard}
            levelRef={levelRef}
            onOpenSettings={onToggleSettings}
          />
        </div>
      )}

      {/* Countdown */}
      {countdownLeft !== null && (
        <div
          role="status"
          aria-live="assertive"
          className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-[2px]"
          style={{ background: `${s.backgroundColor}cc` }}
        >
          <span
            key={countdownLeft}
            className="animate-in fade-in zoom-in-50 font-display text-[min(40vw,16rem)] leading-none duration-500"
            style={{ color: s.highlightColor }}
          >
            {countdownLeft}
          </span>
        </div>
      )}

      {/* Control dock */}
      <div
        inert={hideChrome}
        className={cn(
          "absolute inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 flex justify-center px-3 transition-all duration-300",
          hideChrome ? "pointer-events-none translate-y-3 opacity-0" : "opacity-100",
        )}
      >
        <div className="flex max-w-full items-center gap-0.5 rounded-full border bg-card/85 p-1.5 text-card-foreground shadow-xl backdrop-blur-md">
          <IconButton label="Back to script" shortcut="Esc" onClick={onExit}>
            <ArrowLeft />
          </IconButton>
          <IconButton label="Restart" shortcut="Home" onClick={restart}>
            <RotateCcw />
          </IconButton>

          {canPlay ? (
            <Button
              size="icon-lg"
              className="mx-1 size-11 rounded-full"
              onClick={toggle}
              aria-label={showPause ? (isVoice ? "Stop listening" : "Pause") : isVoice ? "Start listening" : "Play"}
            >
              {showPause ? <Pause className="size-5" /> : <Play className="size-5" />}
            </Button>
          ) : (
            <span className="mx-2 hidden px-2 text-xs text-muted-foreground sm:inline">Manual · scroll or ↑ ↓</span>
          )}

          {hasSpeed && (
            <div className="flex items-center">
              <IconButton
                label="Slower"
                shortcut="↓"
                size="icon-sm"
                onClick={() => setSetting("speed", clamp(s.speed - 5, 40, 300))}
              >
                <Minus />
              </IconButton>
              <span className="min-w-[3.4ch] text-center font-mono text-sm tabular-nums" aria-label={`${s.speed} words per minute`}>
                {s.speed}
              </span>
              <IconButton
                label="Faster"
                shortcut="↑"
                size="icon-sm"
                onClick={() => setSetting("speed", clamp(s.speed + 5, 40, 300))}
              >
                <Plus />
              </IconButton>
            </div>
          )}

          <IconButton
            label="Mirror text"
            shortcut="M"
            className={cn("hidden sm:inline-flex", s.mirrorH && "bg-muted text-primary")}
            onClick={() => setSetting("mirrorH", !s.mirrorH)}
            aria-pressed={s.mirrorH}
          >
            <FlipHorizontal2 />
          </IconButton>
          <IconButton
            label="Settings"
            shortcut="S"
            className={cn(settingsOpen && "bg-muted text-primary")}
            onClick={onToggleSettings}
            aria-pressed={settingsOpen}
          >
            <SlidersHorizontal />
          </IconButton>
          <IconButton
            label={isFullscreen ? "Exit full screen" : "Full screen"}
            shortcut="F"
            className="hidden sm:inline-flex"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize /> : <Maximize />}
          </IconButton>
        </div>
      </div>
    </div>
  );
}
