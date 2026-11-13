import { describe, expect, it } from "vitest";
import { createKeyer, matchCost } from "./matcher";
import { devanagariToRoman, romanKey } from "./phonetic";

describe("devanagariToRoman", () => {
  it("transliterates common words", () => {
    expect(devanagariToRoman("कैसे")).toBe("kaise");
    expect(devanagariToRoman("नमस्ते")).toBe("namaste");
    expect(devanagariToRoman("प्यार")).toBe("pyaar".replace("aa", "a")); // long aa collapses to a
    expect(devanagariToRoman("हैं")).toBe("hain");
  });

  it("drops the final schwa", () => {
    expect(devanagariToRoman("कल")).toBe("kal");
    expect(devanagariToRoman("घर")).toBe("ghar");
  });

  it("passes Latin through", () => {
    expect(devanagariToRoman("office")).toBe("office");
  });
});

describe("romanKey", () => {
  it("merges Hinglish spelling variants", () => {
    expect(romanKey("kaise", true)).toBe(romanKey("kese", true));
    expect(romanKey("kaisay", true)).toBe(romanKey("kaise", true));
    expect(romanKey("seedha", true)).toBe(romanKey("sidha", true));
    expect(romanKey("main", true)).toBe(romanKey("mein", true));
    expect(romanKey("hai", true)).toBe(romanKey("hain", true));
    expect(romanKey("wahan", true)).toBe(romanKey("vahan", true));
  });
});

describe("keys across scripts", () => {
  const key = createKeyer("hinglish");
  const same = (devanagari: string, roman: string) => {
    const c = matchCost(key(devanagari), key(roman));
    expect(c, `${devanagari} vs ${roman}`).toBeGreaterThanOrEqual(0);
    expect(c, `${devanagari} vs ${roman}`).toBeLessThanOrEqual(0.35);
  };

  it("matches Devanagari ASR output to Roman script words", () => {
    same("मैं", "main");
    same("कल", "kal");
    same("ऑफिस", "office");
    same("जा", "jaa");
    same("रहा", "raha");
    same("हूं", "hoon");
    same("और", "aur");
    same("वहां", "wahan");
    same("से", "se");
    same("सीधा", "seedha");
    same("घर", "ghar");
    same("मोबाइल", "mobile");
    same("शुरू", "shuru");
  });

  it("does not confuse different words", () => {
    expect(matchCost(key("कल"), key("ghar"))).toBe(-1);
    expect(matchCost(key("घर"), key("office"))).toBe(-1);
  });
});

describe("english keys", () => {
  const key = createKeyer("en");
  it("ignores case and punctuation, tolerates small errors", () => {
    expect(matchCost(key("Channel,"), key("channel"))).toBe(0);
    expect(matchCost(key("chanel"), key("channel"))).toBeGreaterThan(0);
    expect(matchCost(key("chanel"), key("channel"))).toBeLessThanOrEqual(0.35);
    expect(matchCost(key("there"), key("their"))).toBeGreaterThanOrEqual(0);
    expect(matchCost(key("teleprompter"), key("channel"))).toBe(-1);
  });
});
