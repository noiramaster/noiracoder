/**
 * i18n entry point: translation lookup and persistent per-user language
 * preference stored in ~/.noirarc/prefs.json (overridable via NOIRARC_HOME).
 */

import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_LANGUAGE,
  MESSAGES,
  SUPPORTED_LANGUAGES,
  type Messages,
} from "./dictionary.js";
import { detectLanguageFromPrompt, normalizeLocale } from "./detect.js";

export function T(key: keyof Messages, lang: string): string {
  const entry = MESSAGES[lang] ?? MESSAGES[DEFAULT_LANGUAGE];
  const val = entry?.[key];
  if (typeof val === "string" && val.length > 0) return val;
  const en = MESSAGES[DEFAULT_LANGUAGE];
  const enVal = en?.[key];
  if (typeof enVal === "string" && enVal.length > 0) return enVal;
  return key;
}

interface Prefs {
  language?: string;
}

function defaultConfigDir(): string {
  if (process.env.NOIRARC_HOME) return process.env.NOIRARC_HOME;
  return join(homedir(), ".noirarc");
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
    this.cached = this.normalizeStored(this.readPrefs().language ?? "");
    return this.cached;
  }

  async setLanguage(lang: string): Promise<void> {
    const code = this.normalizeStored(normalizeLocale(lang));
    await mkdir(this.configDir, { recursive: true });
    await writeFile(this.prefsFile, JSON.stringify({ language: code }, null, 2) + "\n", "utf8");
    this.cached = code;
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
      if (parsed !== null && typeof parsed === "object" && typeof Reflect.get(parsed, "language") === "string") {
        return { language: Reflect.get(parsed, "language") as string };
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
  normalizeLocale,
  type Messages,
};