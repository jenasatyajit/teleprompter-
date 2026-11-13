import type { Language } from "@/lib/prompter-options";
import { devanagariToRoman, levenshtein, romanKey, skeleton } from "./phonetic";

/* -------------------------------------------------------------------------- */
/* Token keys                                                                  */
/* -------------------------------------------------------------------------- */

export type TokenKey = {
  /** Comparison key (phonetic for Hindi/Hinglish, lowercase letters for English). */
  key: string;
  /** English only: looser phonetic key to catch homophones. */
  phon: string;
  /** Consonant skeleton. */
  sk: string;
  /** Common/short word: weak evidence of position. */
  weak: boolean;
  /** Nothing speakable (punctuation only). */
  empty: boolean;
};

const EMPTY_KEY: TokenKey = { key: "", phon: "", sk: "", weak: true, empty: true };

const EN_WEAK =
  "the a an and of to in is it that i you he she we they for on with as at be this was are or but not so if my me your do by from have has had will would can";
const HIN_WEAK =
  "hai hain hu hoon ho tha thi the ka ki ke ko se me mein ne par pe aur ya to toh bhi hi na kya yeh ye woh wo is us isko usko ek nahi nahin";

const FILLERS = new Set([
  "um", "umm", "uh", "uhh", "uhm", "hmm", "hm", "hmmm", "mm", "mmm", "er", "erm", "ah", "ahh",
  "अम्म", "हम्म", "उम्म", "अं", "हम्",
]);

const DEVANAGARI_DIGITS = /[०-९]/g;

/** Lowercases and strips punctuation, keeping letters, combining marks and digits. */
export function cleanToken(raw: string): string {
  return raw
    .toLowerCase()
    .replace(DEVANAGARI_DIGITS, (d) => String(d.charCodeAt(0) - 0x0966))
    .replace(/[^\p{L}\p{M}\p{N}]/gu, "");
}

export function createKeyer(language: Language) {
  const hinglish = language !== "en";

  const base = (raw: string): TokenKey => {
    const clean = cleanToken(raw);
    if (!clean) return EMPTY_KEY;

    if (hinglish) {
      if (/\d/.test(clean)) return { key: clean, phon: "", sk: "", weak: false, empty: false };
      const key = romanKey(devanagariToRoman(clean), true);
      if (!key) return EMPTY_KEY;
      return { key, phon: "", sk: skeleton(key), weak: false, empty: false };
    }

    const phon = romanKey(clean, false);
    return { key: clean, phon, sk: skeleton(phon), weak: false, empty: false };
  };

  const weakKeys = new Set(
    (hinglish ? `${HIN_WEAK} ${EN_WEAK}` : EN_WEAK).split(" ").map((w) => base(w).key),
  );

  return (raw: string): TokenKey => {
    const k = base(raw);
    if (k.empty) return k;
    return { ...k, weak: k.key.length <= 2 || weakKeys.has(k.key) };
  };
}

/** Splits a transcript into tokens and removes fillers. */
export function transcriptTokens(text: string): string[] {
  return text
    .split(/\s+/)
    .filter((t) => {
      const c = cleanToken(t);
      return c !== "" && !FILLERS.has(c);
    });
}

/* -------------------------------------------------------------------------- */
/* Costs                                                                       */
/* -------------------------------------------------------------------------- */

const SKIP = 0.1; // skipping one script word
const INS_STRONG = 0.5; // spoken word with no script counterpart (ad-lib / noise)
const INS_WEAK = 0.2;
const SUB_STRONG = 0.55; // mis-recognised word that still occupies a script slot
const SUB_WEAK = 0.7;
const GOOD = 0.35; // cost at or below this counts as a real match

/** Cost of treating `spoken` as `script`; -1 when they do not match at all. */
export function matchCost(spoken: TokenKey, script: TokenKey): number {
  if (spoken.empty || script.empty) return -1;
  if (spoken.key === script.key) return 0;
  if (spoken.phon && spoken.phon === script.phon) return 0.2;

  const la = spoken.key.length;
  const lb = script.key.length;
  const minL = Math.min(la, lb);
  const maxL = Math.max(la, lb);

  if (minL >= 3 && maxL >= 4) {
    const allowed = maxL >= 9 ? 2 : 1;
    const d = levenshtein(spoken.key, script.key, allowed);
    if (d <= allowed) return 0.15 + 0.1 * d;
  }
  if (spoken.sk && spoken.sk === script.sk) {
    if (spoken.sk.length >= 3) return 0.3;
    if (spoken.sk.length >= 2 && minL >= 4) return 0.35;
  }
  return -1;
}

/* -------------------------------------------------------------------------- */
/* Matcher                                                                     */
/* -------------------------------------------------------------------------- */

/** 0 = unread, 1 = read, 2 = skipped */
export const UNREAD = 0;
export const READ = 1;
export const SKIPPED = 2;

type Alignment = {
  cursor: number;
  marks: [index: number, status: number][];
  /** Spoken words that matched a script word. */
  matches: number;
  /** ...of which the script word was not a common word. */
  strong: number;
  /** Script words skipped over (excluding punctuation-only tokens). */
  skips: number;
};

export class ScriptMatcher {
  readonly length: number;
  /** Per-word state, see UNREAD / READ / SKIPPED. Mutated in place; read `version` to detect change. */
  readonly status: Uint8Array;
  /** Incremented whenever cursor or status changed. */
  version = 0;

  private readonly keys: TokenKey[];
  private readonly toKey: (raw: string) => TokenKey;
  /** Cursor committed by the last final result. */
  private base = 0;
  /** Current cursor including the in-progress (interim) segment. */
  private live = 0;
  /** Tokens of the current segment already consumed by a re-anchor. */
  private segSkip = 0;
  private missStreak = 0;

  constructor(words: string[], language: Language) {
    this.toKey = createKeyer(language);
    this.keys = words.map((w) => this.toKey(w));
    this.length = words.length;
    this.status = new Uint8Array(words.length);
  }

  /** Index of the next word to be read (= number of words already passed). */
  get cursor(): number {
    return this.live;
  }

  /**
   * Feeds the transcript of the current segment (everything since the last final).
   * Returns true when the cursor or any status changed.
   */
  feed(text: string, isFinal: boolean): boolean {
    const all = transcriptTokens(text).map(this.toKey).filter((k) => !k.empty);
    const spoken = all.slice(this.segSkip);

    if (spoken.length === 0) {
      if (isFinal) this.commit();
      return false;
    }

    const prevLive = this.live;
    const res = this.align(spoken);
    let changed = false;

    // Interim results may only move forward; the final result is authoritative.
    if (isFinal || res.cursor >= prevLive) {
      changed = this.apply(res);
    }

    // Lost track? Look for the spoken words anywhere in the script.
    const lost =
      (res.matches === 0 && spoken.length >= 4) || (this.missStreak >= 2 && spoken.length >= 3);
    if (lost && this.reanchor(spoken, all.length)) changed = true;

    if (isFinal) {
      this.missStreak = res.matches === 0 && spoken.length >= 2 ? this.missStreak + 1 : 0;
      this.commit();
    }

    if (changed) this.version++;
    return changed;
  }

  /** Jump to a word (e.g. the user double-clicked it). Everything before it counts as read. */
  reset(index: number): void {
    const to = Math.max(0, Math.min(this.length, index));
    this.status.fill(READ, 0, to);
    this.status.fill(UNREAD, to);
    this.base = this.live = to;
    this.segSkip = 0;
    this.missStreak = 0;
    this.version++;
  }

  /** Move forward without speech (silence fallback). */
  advance(count = 1): void {
    const to = Math.min(this.length, this.live + count);
    if (to === this.live) return;
    this.status.fill(READ, this.live, to);
    this.base = this.live = to;
    this.version++;
  }

  /** Called when the segment ends or listening stops. */
  commit(): void {
    this.base = this.live;
    this.segSkip = 0;
  }

  /* ---- internals ---- */

  private apply(res: Alignment): boolean {
    const from = this.base;
    const to = Math.max(this.live, res.cursor);
    let changed = res.cursor !== this.live;

    const before = this.status.slice(from, to);
    this.status.fill(UNREAD, from, to);
    for (const [i, s] of res.marks) this.status[i] = s;
    if (!changed) {
      for (let i = from; i < to; i++) {
        if (this.status[i] !== before[i - from]) {
          changed = true;
          break;
        }
      }
    }
    this.live = res.cursor;
    return changed;
  }

  private skipCost(i: number): number {
    return this.keys[i].empty ? 0 : SKIP;
  }

  private align(spoken: TokenKey[]): Alignment {
    const wide = this.run(spoken, Math.max(70, spoken.length * 2 + 20));
    // A long jump needs more than one real word of evidence.
    if (wide.skips > 6 && wide.strong < 2) return this.run(spoken, 12);
    return wide;
  }

  /** Semi-global alignment of the spoken words against the script, starting at `base`. */
  private run(spoken: TokenKey[], windowSize: number): Alignment {
    const b = this.base;
    const m = spoken.length;
    const W = Math.min(windowSize, this.length - b);
    if (W <= 0) return { cursor: b, marks: [], matches: 0, strong: 0, skips: 0 };

    const cols = W + 1;
    const cost = new Float32Array((m + 1) * cols);
    const dir = new Uint8Array((m + 1) * cols); // 1 = ad-lib, 2 = skip script word, 3 = match/substitute

    for (let p = 1; p <= W; p++) {
      cost[p] = cost[p - 1] + this.skipCost(b + p - 1);
      dir[p] = 2;
    }

    for (let i = 1; i <= m; i++) {
      const sp = spoken[i - 1];
      const ins = sp.weak ? INS_WEAK : INS_STRONG;
      const row = i * cols;
      const prev = (i - 1) * cols;

      cost[row] = cost[prev] + ins;
      dir[row] = 1;

      for (let p = 1; p <= W; p++) {
        const script = this.keys[b + p - 1];

        const viaMatch = (() => {
          if (script.empty) return Infinity;
          const c = matchCost(sp, script);
          if (c >= 0) return cost[prev + p - 1] + c;
          return cost[prev + p - 1] + (sp.weak || script.weak ? SUB_WEAK : SUB_STRONG);
        })();
        const viaIns = cost[prev + p] + ins;
        const viaSkip = cost[row + p - 1] + this.skipCost(b + p - 1);

        // Ties prefer match, then ad-lib, then skip.
        let best = viaMatch;
        let d = 3;
        if (viaIns < best) {
          best = viaIns;
          d = 1;
        }
        if (viaSkip < best) {
          best = viaSkip;
          d = 2;
        }
        cost[row + p] = best;
        dir[row + p] = d;
      }
    }

    // Best end position; ties prefer the smaller advance.
    let bestP = 0;
    let bestCost = cost[m * cols];
    for (let p = 1; p <= W; p++) {
      if (cost[m * cols + p] < bestCost) {
        bestCost = cost[m * cols + p];
        bestP = p;
      }
    }

    const marks: [number, number][] = [];
    let matches = 0;
    let strong = 0;
    let skips = 0;
    let i = m;
    let p = bestP;
    while (i > 0 || p > 0) {
      const d = dir[i * cols + p];
      if (d === 3) {
        const script = this.keys[b + p - 1];
        const c = matchCost(spoken[i - 1], script);
        marks.push([b + p - 1, READ]);
        if (c >= 0 && c <= GOOD) {
          matches++;
          if (!script.weak) strong++;
        }
        i--;
        p--;
      } else if (d === 1) {
        i--;
      } else {
        const script = this.keys[b + p - 1];
        if (script.empty) marks.push([b + p - 1, READ]);
        else {
          marks.push([b + p - 1, SKIPPED]);
          skips++;
        }
        p--;
      }
    }

    return { cursor: b + bestP, marks, matches, strong, skips };
  }

  /**
   * Looks for the last few spoken words as a consecutive run anywhere in the script
   * (the speaker jumped, or did a retake) and moves there.
   */
  private reanchor(spoken: TokenKey[], consumedTokens: number): boolean {
    const t = Math.min(6, spoken.length);
    const tail = spoken.slice(-t);
    let bestRun = 0;
    let bestEnd = -1;

    for (let p = 0; p < this.length; p++) {
      let run = 0;
      for (let k = 0; k < t && p - k >= 0; k++) {
        const script = this.keys[p - k];
        const c = matchCost(tail[t - 1 - k], script);
        if (c >= 0 && c <= GOOD) run++;
        else break;
      }
      if (run < 3) continue;
      const better =
        run > bestRun ||
        (run === bestRun && Math.abs(p + 1 - this.live) < Math.abs(bestEnd + 1 - this.live));
      if (better) {
        bestRun = run;
        bestEnd = p;
      }
    }
    if (bestEnd < 0) return false;

    const to = bestEnd + 1;
    if (to === this.live) return false;

    if (to > this.live) {
      for (let i = this.live; i < to; i++) {
        if (this.status[i] === UNREAD && !this.keys[i].empty) this.status[i] = SKIPPED;
      }
    } else {
      this.status.fill(UNREAD, to, this.live);
    }
    this.status.fill(READ, to - bestRun, to);

    this.base = this.live = to;
    this.segSkip = consumedTokens;
    this.missStreak = 0;
    return true;
  }
}
