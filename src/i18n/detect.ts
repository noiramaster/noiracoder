/**
 * Heuristic language detection from raw prompt text: classifies the dominant
 * Unicode script and maps it to an ISO 639-1 language code.
 */

type Ranges = ReadonlyArray<readonly [number, number]>;

const SCRIPT_RANGES: ReadonlyArray<readonly [string, Ranges]> = [
  ["latin", [[0x0041, 0x005a], [0x0061, 0x007a], [0x00c0, 0x00ff], [0x0100, 0x017f], [0x0180, 0x024f], [0x1e00, 0x1eff], [0x2c60, 0x2c7f], [0xa720, 0xa7ff], [0xff21, 0xff3a], [0xff41, 0xff5a]]],
  ["cyrillic", [[0x0400, 0x04ff], [0x0500, 0x052f]]],
  ["arabic", [[0x0600, 0x06ff], [0x0750, 0x077f], [0x08a0, 0x08ff], [0xfb50, 0xfdff], [0xfe70, 0xfeff]]],
  ["hebrew", [[0x0590, 0x05ff]]],
  ["devanagari", [[0x0900, 0x097f]]],
  ["gurmukhi", [[0x0a00, 0x0a7f]]],
  ["gujarati", [[0x0a80, 0x0aff]]],
  ["bengali", [[0x0980, 0x09ff]]],
  ["tamil", [[0x0b80, 0x0bff]]],
  ["telugu", [[0x0c00, 0x0c7f]]],
  ["kannada", [[0x0c80, 0x0cff]]],
  ["malayalam", [[0x0d00, 0x0d7f]]],
  ["sinhala", [[0x0d80, 0x0dff]]],
  ["armenian", [[0x0530, 0x058f]]],
  ["han", [[0x3400, 0x4dbf], [0x4e00, 0x9fff]]],
  ["hangul", [[0x1100, 0x11ff], [0x3130, 0x318f], [0xac00, 0xd7af]]],
  ["kana", [[0x3040, 0x309f], [0x30a0, 0x30ff], [0x31f0, 0x31ff]]],
  ["thai", [[0x0e00, 0x0e7f]]],
  ["greek", [[0x0370, 0x03ff], [0x1f00, 0x1fff]]],
];

const SCRIPT_TO_LANG: Record<string, string> = {
  cyrillic: "ru",
  arabic: "ar",
  hebrew: "he",
  devanagari: "hi",
  gurmukhi: "pa",
  gujarati: "gu",
  bengali: "bn",
  tamil: "ta",
  telugu: "te",
  kannada: "kn",
  malayalam: "ml",
  sinhala: "si",
  armenian: "hy",
  han: "zh",
  hangul: "ko",
  kana: "ja",
  thai: "th",
  greek: "el",
};

const MIN_CHARS = 5;
const MIN_DOMINANCE = 0.6;

export function detectLanguageFromPrompt(prompt: string): string | null {
  const counts: Record<string, number> = {};
  let total = 0;

  for (const ch of prompt) {
    const code = ch.codePointAt(0) as number;
    for (const [script, ranges] of SCRIPT_RANGES) {
      for (const [lo, hi] of ranges) {
        if (code >= lo && code <= hi) {
          counts[script] = (counts[script] ?? 0) + 1;
          total += 1;
          break;
        }
      }
    }
  }

  if (total < MIN_CHARS) return null;

  const kana = counts.kana ?? 0;
  const han = counts.han ?? 0;
  if (kana > 0 && han > 0 && kana * 10 >= han) {
    counts.kana = kana + han;
    delete counts.han;
  }

  let best: string | null = null;
  let bestCount = 0;
  for (const [script, count] of Object.entries(counts)) {
    if (count > bestCount) {
      best = script;
      bestCount = count;
    }
  }

  if (best === null || bestCount / total < MIN_DOMINANCE) return null;
  if (best === "latin") return detectLatinLanguage(prompt);
  return SCRIPT_TO_LANG[best] ?? null;
}

// Latin disambiguation: stopwords + bigrams (simple, no deps)
const LATIN_STOPWORDS: Record<string, string[]> = {
  es: ["el", "la", "de", "que", "y", "en", "un", "ser", "con", "para", "por", "hola", "gracias", "como", "quiero", "hacer", "tarea"],
  en: ["the", "is", "and", "to", "of", "you", "that", "have", "with", "for", "hello", "thanks", "how", "want", "task"],
  fr: ["le", "la", "de", "que", "et", "en", "un", "être", "avec", "pour", "par", "bonjour", "merci", "comment", "tâche"],
  pt: ["o", "a", "de", "que", "e", "em", "um", "ser", "com", "para", "por", "olá", "obrigado", "como", "tarefa"],
  de: ["der", "die", "das", "und", "in", "zu", "den", "von", "mit", "ist", "hallo", "danke", "wie", "aufgabe"],
  it: ["il", "la", "di", "che", "e", "in", "un", "essere", "con", "per", "ciao", "grazie", "come", "compito"],
};

function detectLatinLanguage(prompt: string): string | null {
  const words = prompt.toLowerCase().split(/[^a-záéíóúàèìòùâêîôûäëïöüñç]+/).filter((w) => w.length > 1);
  if (words.length < 2) return null;
  const scores: Record<string, number> = {};
  for (const [lang, stops] of Object.entries(LATIN_STOPWORDS)) {
    const set = new Set(stops);
    let s = 0;
    for (const w of words) if (set.has(w)) s++;
    scores[lang] = s;
  }
  let best: string | null = null;
  let bestScore = 0;
  for (const [lang, score] of Object.entries(scores)) {
    if (score > bestScore) { best = lang; bestScore = score; }
  }
  return bestScore >= 1 ? best : null;
}

/** "es-ES" -> "es", "en_US" -> "en", "zh-Hant" -> "zh". */
export function normalizeLocale(locale: string): string {
  const match = /^[a-zA-Z]+/.exec(locale.trim());
  return match ? match[0].toLowerCase() : "";
}