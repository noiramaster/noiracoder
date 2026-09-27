/**
 * i18n entry point: translation lookup and persistent per-user language
 * preference stored in ~/.noirarc/prefs.json (overridable via NOIRARC_HOME).
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_LANGUAGE,
  MESSAGES,
  SUPPORTED_LANGUAGES,
  type Messages,
} from "./dictionary.js";
import { detectLanguageFromPrompt, detectOsLang, normalizeLocale } from "./detect.js";

export function T(key: keyof Messages, lang: string): string {
  const entry = MESSAGES[lang] ?? MESSAGES[DEFAULT_LANGUAGE];
  const val = entry?.[key];
  if (typeof val === "string" && val.length > 0) return val;
  const en = MESSAGES[DEFAULT_LANGUAGE];
  const enVal = en?.[key];
  if (typeof enVal === "string" && enVal.length > 0) return enVal;
  return key;
}

/**
 * HITO 4.7: aviso de primer uso (una sola vez por equipo): los modelos
 * gratuitos pueden registrar lo enviado. Marca en ~/.noirarc/.freewarn-shown.
 */
export async function freeWarningOnce(log: { warn: (m: string) => void }, lang: string): Promise<boolean> {
  const dir = defaultConfigDir();
  const flag = join(dir, ".freewarn-shown");
  try {
    await readFile(flag, "utf8");
    return false;
  } catch { /* primera vez */ }
  log.warn(T("freeWarning", lang));
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(flag, "1", "utf8");
  } catch { /* aviso mostrado igualmente */ }
  return true;
}

interface Prefs {
  language?: string;
  /** Idioma de las respuestas del modelo: "auto" (como escribe el usuario),
   * "ui" (como la interfaz) o un código fijo. */
  answerLang?: string;
  /** M2.7: panel abierto + sesión activa (lo recuerda la Go). */
  panelOpen?: boolean;
  sessionId?: string | null;
}

function defaultConfigDir(): string {
  // NOIRARC_HOME equivale a home (como Go y sessions.ts): siempre .noirarc debajo.
  return join(process.env.NOIRARC_HOME ?? homedir(), ".noirarc");
}

export class LanguageSelector {
  private readonly configDir: string;
  private readonly prefsFile: string;
  private cached: string | null = null;

  constructor(configDir?: string) {
    this.configDir = configDir ?? defaultConfigDir();
    this.prefsFile = join(this.configDir, "prefs.json");
  }

  getLanguage(): string {
    if (this.cached !== null) return this.cached;
    const stored = this.readPrefs().language ?? "";
    if (stored) {
      this.cached = this.normalizeStored(stored);
      return this.cached;
    }
    // M1.4: primer arranque sin prefs → idioma del SO, sin preguntar, y se guarda.
    // HH: se fusiona con lo que haya (el cliente Go guarda welcomed/mouse en
    // el mismo fichero; escribir solo {language} lo borraría y la bienvenida
    // saldría en cada arranque).
    const code = this.normalizeStored(detectOsLang());
    try {
      mkdirSync(this.configDir, { recursive: true });
      let prev: Record<string, unknown> = {};
      try {
        const raw = readFileSync(this.prefsFile, "utf8");
        const p: unknown = JSON.parse(raw);
        if (p !== null && typeof p === "object") prev = p as Record<string, unknown>;
      } catch { /* nada que conservar */ }
      writeFileSync(this.prefsFile, JSON.stringify({ ...prev, language: code }, null, 2) + "\n", "utf8");
    } catch { /* idioma ya resuelto; persistirá cuando se pueda */ }
    this.cached = code;
    return this.cached;
  }

  async setLanguage(lang: string): Promise<void> {
    const code = this.normalizeStored(normalizeLocale(lang));
    const prev = this.readPrefs();
    await mkdir(this.configDir, { recursive: true });
    await writeFile(this.prefsFile, JSON.stringify({ ...prev, language: code }, null, 2) + "\n", "utf8");
    this.cached = code;
  }

  /** M1.5: idioma de respuesta (auto|ui|código). */
  getAnswerLang(): string {
    const a = this.readPrefs().answerLang ?? "auto";
    if (a === "auto" || a === "ui") return a;
    return this.normalizeStored(normalizeLocale(a));
  }

  async setAnswerLang(mode: string): Promise<string> {
    const m = mode === "ui" ? "ui" : mode === "auto" ? "auto" : this.normalizeStored(normalizeLocale(mode));
    const prev = this.readPrefs();
    await mkdir(this.configDir, { recursive: true });
    await writeFile(this.prefsFile, JSON.stringify({ ...prev, answerLang: m }, null, 2) + "\n", "utf8");
    return m;
  }

  /** Resuelve el idioma de respuesta para un turno: auto→lengua del mensaje. */
  resolveAnswerLang(msgLang: string, uiLang: string): string {
    const a = this.getAnswerLang();
    if (a === "ui") return uiLang;
    if (a === "auto") return msgLang || uiLang;
    return a;
  }

  /** M2.7: UI recordada (panel + sesión). */
  getUi(): { panelOpen: boolean; sessionId: string | null } {
    const p = this.readPrefs();
    return { panelOpen: p.panelOpen ?? true, sessionId: p.sessionId ?? null };
  }

  async setUi(ui: { panelOpen?: boolean; sessionId?: string | null }): Promise<void> {
    const prev = this.readPrefs();
    await mkdir(this.configDir, { recursive: true });
    await writeFile(
      this.prefsFile,
      JSON.stringify({ ...prev, ...(ui.panelOpen !== undefined ? { panelOpen: ui.panelOpen } : {}), ...(ui.sessionId !== undefined ? { sessionId: ui.sessionId } : {}) }, null, 2) + "\n",
      "utf8"
    );
  }

  async resolveLanguage(prompt: string): Promise<string> {
    const stored = this.readPrefs().language;
    if (stored) return this.getLanguage();
    const detected = detectLanguageFromPrompt(prompt);
    if (detected) {
      this.cached = this.normalizeStored(detected);
      return this.cached;
    }
    return this.getLanguage();
  }

  private readPrefs(): Prefs {
    try {
      const raw = readFileSync(this.prefsFile, "utf8");
      const parsed: unknown = JSON.parse(raw);
      if (parsed !== null && typeof parsed === "object") {
        const out: Prefs = {};
        if (typeof Reflect.get(parsed, "language") === "string") {
          out.language = Reflect.get(parsed, "language") as string;
        }
        if (typeof Reflect.get(parsed, "answerLang") === "string") {
          out.answerLang = Reflect.get(parsed, "answerLang") as string;
        }
        if (typeof Reflect.get(parsed, "panelOpen") === "boolean") {
          out.panelOpen = Reflect.get(parsed, "panelOpen") as boolean;
        }
        const sid = Reflect.get(parsed, "sessionId");
        if (typeof sid === "string" || sid === null) {
          out.sessionId = sid as string | null;
        }
        return out;
      }
    } catch {
      // prefs missing or malformed: fall through to defaults
    }
    return {};
  }

  private normalizeStored(lang: string): string {
    if (lang && SUPPORTED_LANGUAGES.includes(lang)) return lang;
    return DEFAULT_LANGUAGE;
  }
}

export {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  detectLanguageFromPrompt,
  detectOsLang,
  normalizeLocale,
  type Messages,
};