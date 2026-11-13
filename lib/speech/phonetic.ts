/**
 * Phonetic helpers used to compare what Deepgram heard with the script.
 *
 * Deepgram returns Devanagari for Hindi/Hinglish speech, while scripts are written in
 * Roman letters with free-form spelling ("kaise", "kese", "kaisay"). Both sides are
 * reduced to the same rough phonetic key so they can be compared.
 */

// ---- Devanagari -> Roman ----------------------------------------------------

const VOWELS_INDEPENDENT: Record<string, string> = {
  "अ": "a", "आ": "a", "इ": "i", "ई": "i", "उ": "u", "ऊ": "u", "ऋ": "ri",
  "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au", "ऑ": "o", "ऍ": "e",
};

const MATRAS: Record<string, string> = {
  "ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u", "ृ": "ri",
  "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ॉ": "o", "ॅ": "e",
};

const CONSONANTS: Record<string, string> = {
  "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "n",
  "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "n",
  "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
  "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
  "प": "p", "फ": "f", "ब": "b", "भ": "bh", "म": "m",
  "य": "y", "र": "r", "ल": "l", "व": "v", "श": "sh", "ष": "sh",
  "स": "s", "ह": "h", "ळ": "l",
};

// Consonants whose sound changes with a nukta (e.g. ड़ is "r", ज़ is "z").
const NUKTA_CONSONANTS: Record<string, string> = {
  "ड": "r", "ढ": "r", "ज": "z", "फ": "f", "क": "q", "ख": "kh", "ग": "g",
};

const VIRAMA = "्";
const NUKTA = "़";
const NASALS = new Set(["ं", "ँ"]);
const VISARGA = "ः";

type Unit = {
  /** Consonant sound ("" for a bare vowel) or a passed-through Latin chunk. */
  c: string;
  /** Explicit vowel from a matra / independent vowel. */
  v: string | null;
  /** Consonant carries a virama (no vowel). */
  vir: boolean;
  /** Trailing nasal / visarga. */
  post: string;
  raw: boolean;
};

/** Rough, deterministic Devanagari -> Roman transliteration. Latin text passes through. */
export function devanagariToRoman(input: string): string {
  const s = input.normalize("NFD");
  const units: Unit[] = [];

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (CONSONANTS[ch]) {
      let c = CONSONANTS[ch];
      if (s[i + 1] === NUKTA) {
        c = NUKTA_CONSONANTS[ch] ?? c;
        i++;
      }
      units.push({ c, v: null, vir: false, post: "", raw: false });
    } else if (VOWELS_INDEPENDENT[ch]) {
      units.push({ c: "", v: VOWELS_INDEPENDENT[ch], vir: false, post: "", raw: false });
    } else if (MATRAS[ch]) {
      const last = units[units.length - 1];
      if (last && !last.raw && last.v === null && !last.vir) last.v = MATRAS[ch];
    } else if (ch === VIRAMA) {
      const last = units[units.length - 1];
      if (last && !last.raw) last.vir = true;
    } else if (NASALS.has(ch)) {
      const last = units[units.length - 1];
      if (last) last.post += "n";
    } else if (ch === VISARGA) {
      const last = units[units.length - 1];
      if (last) last.post += "h";
    } else if (ch === NUKTA) {
      // stray nukta: ignore
    } else {
      units.push({ c: ch.toLowerCase(), v: null, vir: false, post: "", raw: true });
    }
  }

  // Which units carry a vowel sound (explicit, or the inherent schwa)?
  const syllables: number[] = [];
  units.forEach((u, idx) => {
    if (u.raw) return;
    if (u.v !== null || (!u.vir && u.c !== "")) syllables.push(idx);
  });

  const deleteSchwa = new Set<number>();
  const lastIdx = units.length - 1;
  syllables.forEach((idx, pos) => {
    const u = units[idx];
    if (u.v !== null || u.c === "") return; // only inherent schwas can be dropped
    const isFinalUnit = idx === lastIdx;
    const beforeCluster = !!units[idx + 1]?.vir; // schwa stays before a conjunct (na-mas-te)
    const isPenultimateSyllable = pos === syllables.length - 2;
    const lastSyllable = units[syllables[syllables.length - 1]];
    if (
      isFinalUnit ||
      (isPenultimateSyllable && !beforeCluster && syllables.length >= 3 && lastSyllable.v !== null)
    ) {
      deleteSchwa.add(idx);
    }
  });

  let out = "";
  units.forEach((u, idx) => {
    if (u.raw) {
      out += u.c;
      return;
    }
    out += u.c;
    if (u.v !== null) out += u.v;
    else if (!u.vir && u.c !== "" && !deleteSchwa.has(idx)) out += "a";
    out += u.post;
  });
  return out;
}

// ---- Roman -> phonetic key ----------------------------------------------------

/**
 * Collapses Roman spelling variants into one key ("kaise", "kese", "kaisay" -> "kese").
 * `hinglish` additionally drops a final nasal ("hain", "hai", "mein", "main" -> "he"/"me").
 */
export function romanKey(input: string, hinglish: boolean): string {
  let s = input.toLowerCase().replace(/[^a-z]/g, "");
  if (!s) return "";

  s = s.replace(/sh/g, "s").replace(/ch/g, "#").replace(/ph/g, "f");
  s = s.replace(/c(?=[eiy])/g, "s").replace(/c/g, "k").replace(/#/g, "c");
  s = s.replace(/([kgjtdbp])h/g, "$1");
  s = s.replace(/q/g, "k").replace(/x/g, "ks").replace(/z/g, "j").replace(/w/g, "v");
  s = s
    .replace(/ee|ii/g, "i")
    .replace(/oo|uu/g, "u")
    .replace(/aa/g, "a")
    .replace(/ai|ae|ei|ey|ay/g, "e")
    .replace(/au|ou|ow/g, "o");
  s = s.replace(/(.)\1+/g, "$1");
  if (hinglish && s.length >= 3) s = s.replace(/([aeiou])n$/, "$1");
  return s;
}

/** Consonant skeleton: stable across vowel-spelling differences ("ofis" ~ "mobel"/"mobile"). */
export function skeleton(key: string): string {
  return key.replace(/[aeiou]/g, "").replace(/(.)\1+/g, "$1");
}

/** Bounded Levenshtein distance; returns max + 1 when the distance exceeds `max`. */
export function levenshtein(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
