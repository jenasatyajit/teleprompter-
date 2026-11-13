import { describe, expect, it } from "vitest";
import { READ, ScriptMatcher, SKIPPED, UNREAD } from "./matcher";

const EN_SCRIPT =
  "Welcome back to the channel. Today I want to show you how a good teleprompter should feel. " +
  "It should stay out of your way. The words move when you need them and wait when you pause.";

const words = (s: string) => s.split(/\s+/).filter(Boolean);
const idx = (list: string[], w: string) => list.findIndex((x) => x.toLowerCase().replace(/\W/g, "") === w);

function en() {
  const w = words(EN_SCRIPT);
  return { w, m: new ScriptMatcher(w, "en") };
}

describe("ScriptMatcher (English)", () => {
  it("follows normal reading, interim then final", () => {
    const { m } = en();
    m.feed("welcome", false);
    expect(m.cursor).toBe(1);
    m.feed("welcome back to", false);
    expect(m.cursor).toBe(3);
    m.feed("welcome back to the", true);
    expect(m.cursor).toBe(4);
    m.feed("channel today", true);
    expect(m.cursor).toBe(6);
    expect(Array.from(m.status.slice(0, 6))).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it("does not advance twice when an interim result is revised", () => {
    const { m } = en();
    m.feed("welcom back", false);
    m.feed("welcome back to the", false);
    m.feed("welcome back to the channel", true);
    expect(m.cursor).toBe(5);
    expect(m.status.slice(0, 5).every((s) => s === READ)).toBe(true);
  });

  it("highlights skipped words when a few are skipped", () => {
    const { w, m } = en();
    m.feed("welcome back channel today", true);
    expect(m.cursor).toBe(idx(w, "today") + 1);
    expect(m.status[idx(w, "to")]).toBe(SKIPPED);
    expect(m.status[idx(w, "the")]).toBe(SKIPPED);
    expect(m.status[idx(w, "channel")]).toBe(READ);
  });

  it("jumps ahead by a single content word when the skip is short", () => {
    const { w, m } = en();
    m.feed("welcome back", true);
    m.feed("channel", false);
    expect(m.cursor).toBe(idx(w, "channel") + 1);
  });

  it("treats a misrecognised word as read, not skipped", () => {
    const { m } = en();
    m.feed("welcome back to the chanell today", true);
    expect(m.cursor).toBe(6);
    expect(m.status.slice(0, 6).every((s) => s === READ)).toBe(true);
  });

  it("ignores ad-libs and filler words", () => {
    const { w, m } = en();
    m.feed("welcome um back you know to the", true);
    expect(m.cursor).toBe(idx(w, "the") + 1);
    expect(m.status.slice(0, 4).every((s) => s === READ)).toBe(true);
  });

  it("does not make a big jump on one matching word", () => {
    const { m } = en();
    m.feed("welcome back", true);
    m.feed("stay", false);
    expect(m.cursor).toBe(2);
  });

  it("makes a big jump once there is enough evidence, marking the gap as skipped", () => {
    const { w, m } = en();
    m.feed("welcome back", true);
    m.feed("stay out of your way", true);
    expect(m.cursor).toBe(idx(w, "way") + 1);
    expect(m.status[idx(w, "teleprompter")]).toBe(SKIPPED);
    expect(m.status[idx(w, "stay")]).toBe(READ);
  });

  it("re-anchors backwards for a retake", () => {
    const { w, m } = en();
    m.feed("welcome back to the channel today I want to show you how a good teleprompter should feel", true);
    expect(m.cursor).toBe(idx(w, "feel") + 1);
    m.feed("welcome back to the channel", true);
    expect(m.cursor).toBe(5);
    expect(m.status[idx(w, "feel")]).toBe(UNREAD);
  });

  it("prefers the nearest repeat of a phrase", () => {
    const m = new ScriptMatcher(words("one two three four five six one two three four five six"), "en");
    m.feed("one two three four five six", true);
    m.feed("one two", false);
    expect(m.cursor).toBe(8);
  });

  it("reset() jumps and marks earlier words read", () => {
    const { m } = en();
    m.reset(10);
    expect(m.cursor).toBe(10);
    expect(m.status[9]).toBe(READ);
    expect(m.status[10]).toBe(UNREAD);
  });

  it("stops at the end of the script", () => {
    const m = new ScriptMatcher(words("the end"), "en");
    m.feed("the end and then some more words", true);
    expect(m.cursor).toBe(2);
  });
});

describe("ScriptMatcher (Hinglish, Devanagari speech vs Roman script)", () => {
  const script = "Main kal office jaa raha hoon aur wahan se seedha ghar aaunga. Phir hum khana khayenge.";
  const w = words(script);

  it("follows Devanagari output against a Roman script", () => {
    const m = new ScriptMatcher(w, "hinglish");
    m.feed("मैं कल ऑफिस", false);
    expect(m.cursor).toBe(3);
    m.feed("मैं कल ऑफिस जा रहा हूं और", true);
    expect(m.cursor).toBe(idx(w, "aur") + 1);
    m.feed("वहां से सीधा घर", true);
    expect(m.cursor).toBe(idx(w, "ghar") + 1);
  });

  it("marks skipped Hinglish words", () => {
    const m = new ScriptMatcher(w, "hinglish");
    m.feed("मैं कल ऑफिस और वहां से", true);
    expect(m.status[idx(w, "raha")]).toBe(SKIPPED);
    expect(m.cursor).toBe(idx(w, "se") + 1);
  });

  it("also works with English words spoken inside Hindi", () => {
    const m = new ScriptMatcher(w, "hinglish");
    m.feed("main kal office jaa raha hoon", true);
    expect(m.cursor).toBe(idx(w, "hoon") + 1);
  });
});
