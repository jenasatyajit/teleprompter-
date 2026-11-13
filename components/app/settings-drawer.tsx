"use client";

import { useCallback, useEffect, useId, useRef } from "react";
import {
  AnimatePresence,
  motion,
  useDragControls,
  useReducedMotion,
  type Transition,
} from "motion/react";
import { SettingsPanel } from "@/components/prompter/settings-panel";
import { useMediaQuery } from "@/hooks/use-media-query";

/** Ease-in-out cubic: gentle start, gentle stop. */
const EASE_IN_OUT: [number, number, number, number] = [0.65, 0, 0.35, 1];
const PANEL_WIDTH = 352; // px, desktop column

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Text-entry controls, where letter keys must type instead of acting as shortcuts. */
const TEXT_ENTRY =
  "textarea, select, [contenteditable='true'], input:not([type='range']):not([type='checkbox']):not([type='radio']):not([type='button']):not([type='color'])";

/** Open pop-ups (select lists, menus) that handle their own keys, including Escape. */
const POPUP = "[role='listbox'], [role='option'], [role='menu'], [role='menuitem']";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Settings as a collapsible window.
 * - Desktop (≥1024px): slides in over the right edge of the screen.
 * - Smaller screens: a bottom sheet with a backdrop; drag the handle down (or tap outside) to close.
 *
 * Only `transform` and `opacity` are animated, so the page underneath never re-lays out
 * mid-animation and the motion stays on the compositor.
 */
export function SettingsDrawer({ open, onOpenChange }: Props) {
  const isDesktop = useMediaQuery("(min-width: 1024px)", true);
  const reduce = useReducedMotion();
  const titleId = useId();
  const dragControls = useDragControls();

  const panelRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  // Move focus into the window when it opens; remember where it came from.
  useEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    returnFocusRef.current = active instanceof HTMLElement ? active : null;
    const id = requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(id);
  }, [open, isDesktop]);

  const restoreFocus = useCallback(() => {
    const el = returnFocusRef.current;
    returnFocusRef.current = null;
    // Only if focus was left inside the (now removed) window.
    if (el?.isConnected && (document.activeElement === document.body || !document.activeElement)) {
      el.focus({ preventScroll: true });
    }
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>, trapFocus: boolean) => {
      const target = e.target as HTMLElement;
      // Keys inside an open select list / menu belong to it (typeahead, Escape to close it).
      if (target.closest(POPUP)) return;

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      }

      // "S" toggles settings everywhere, so it must also close them from inside the panel.
      if (
        (e.key === "s" || e.key === "S") &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !target.closest(TEXT_ENTRY)
      ) {
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      }

      if (!trapFocus || e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => n.offsetParent !== null || n === document.activeElement,
      );
      if (nodes.length === 0) {
        e.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [close],
  );

  // ---- transitions --------------------------------------------------------
  const enter: Transition = { type: "tween", ease: EASE_IN_OUT, duration: reduce ? 0 : 0.42 };
  const leave: Transition = { type: "tween", ease: EASE_IN_OUT, duration: reduce ? 0 : 0.34 };
  const fadeIn: Transition = { type: "tween", ease: EASE_IN_OUT, duration: reduce ? 0 : 0.3 };
  const fadeOut: Transition = { type: "tween", ease: EASE_IN_OUT, duration: reduce ? 0 : 0.26 };

  if (isDesktop) {
    // Push layout without dragging the panel through layout every frame (pattern from
    // GitBook's Motion sidebar): an invisible spacer animates its width to push the main
    // area aside, while the panel itself only animates a transform, pinned to the right edge.
    // Both share one transition so the panel stays glued to the moving boundary.
    return (
      <AnimatePresence initial={false} onExitComplete={restoreFocus}>
        {open && (
          <motion.div
            key="settings-spacer"
            aria-hidden
            className="h-full shrink-0"
            initial={{ width: 0 }}
            animate={{ width: PANEL_WIDTH, transition: enter }}
            exit={{ width: 0, transition: leave }}
          />
        )}
        {open && (
          <motion.aside
            key="settings-panel"
            ref={panelRef}
            tabIndex={-1}
            data-settings-panel=""
            aria-labelledby={titleId}
            className="fixed inset-y-0 right-0 z-30 flex flex-col border-l bg-background text-foreground outline-none will-change-transform"
            style={{ width: PANEL_WIDTH }}
            initial={{ x: "100%" }}
            animate={{ x: 0, transition: enter }}
            exit={{ x: "100%", transition: leave }}
            onKeyDown={(e) => onKeyDown(e, false)}
          >
            <SettingsPanel titleId={titleId} onClose={close} />
          </motion.aside>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence onExitComplete={restoreFocus}>
      {open && (
        <motion.div
          key="settings-backdrop"
          aria-hidden
          className="fixed inset-0 z-50 bg-black/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: fadeIn }}
          exit={{ opacity: 0, transition: fadeOut }}
          onClick={close}
        />
      )}
      {open && (
        <motion.div
          key="settings-sheet"
          ref={panelRef as React.RefObject<HTMLDivElement>}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          data-settings-panel=""
          className="fixed inset-x-0 bottom-0 z-50 flex h-[min(85dvh,44rem)] flex-col rounded-t-3xl border-t bg-background pb-[env(safe-area-inset-bottom)] text-foreground shadow-2xl outline-none will-change-transform"
          initial={{ y: "100%" }}
          animate={{ y: 0, transition: enter }}
          exit={{ y: "100%", transition: leave }}
          drag="y"
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.7 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 110 || info.velocity.y > 550) close();
          }}
          onKeyDown={(e) => onKeyDown(e, true)}
        >
          {/* Drag handle: only this starts a drag, so the settings list scrolls normally. */}
          <div
            aria-hidden
            className="flex shrink-0 cursor-grab touch-none justify-center pt-3 pb-1 active:cursor-grabbing"
            onPointerDown={(e) => dragControls.start(e)}
          >
            <span className="h-1.5 w-10 rounded-full bg-muted-foreground/30" />
          </div>
          <SettingsPanel titleId={titleId} onClose={close} className="min-h-0 flex-1" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
