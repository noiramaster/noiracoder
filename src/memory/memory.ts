/**
 * Hierarchical, relevance-filtered memory.
 *
 * Layers (highest specificity wins on collision):
 *   1. project  -> AGENTS.md in the working directory (open standard, Claude/OpenCode compatible)
 *   2. global   -> ~/.noirarc/memory/global.md (language, general preferences)
 *   3. notes    -> ~/.noirarc/memory/notes.json (tagged, relevance-filtered, auto-consolidated)
 *
 * The compiled memory is injected through the cacheable system prefix. Only
 * notes whose tags match the current task are included, so context stays
 * relevant and prompt-cache friendly instead of dumping everything.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";

export interface MemoryNote {
  id: string;
  category: "decision" | "fact" | "preference" | "convention";
  tags: string[];
  title: string;
  body: string;
  createdAt: string;
  /** Set when this note was promoted to global.md (won't promote twice). */
  promoted?: boolean;
}

const GLOBAL_AUTO_HEADER = "## Noira (auto)";

function globalFile(): string {
  return join(globalDir(), "global.md");
}

async function readGlobal(): Promise<string> {
  return readIfExists(globalFile());
}

/**
 * Appends lines to the managed auto block of global.md, preserving anything
 * the user wrote by hand. Creates the file with a template when missing.
 */
export async function rememberGlobal(lines: string[]): Promise<number> {
  const clean = lines.map((l) => l.trim()).filter(Boolean);
  if (!clean.length) return 0;
  let cur = await readGlobal();
  if (!cur.trim()) {
    cur = `# Memoria global — NoiraCoder\n\nPreferencias y patrones del usuario. Edítalo a mano cuando quieras.\n`;
  }
  const dated = new Date().toISOString().slice(0, 10);
  const fresh = clean.filter((l) => !cur.includes(l.slice(0, 60)));
  if (!fresh.length) return 0;
  const block = fresh.map((l) => `- [${dated}] ${l}`).join("\n");
  const next = cur.includes(GLOBAL_AUTO_HEADER)
    ? cur.trimEnd() + `\n${block}\n`
    : cur.trimEnd() + `\n\n${GLOBAL_AUTO_HEADER}\n\n${block}\n`;
  await mkdir(globalDir(), { recursive: true });
  await writeFile(globalFile(), next, "utf8");
  return fresh.length;
}

const PREF_PATTERNS: RegExp[] = [
  /\b(prefiero|me gusta(?:n)?|mejor|recuerda(?: que)?|no quiero|evita|evitar|siempre|nunca|odio|utiliza|usa|quiero que)\b/i,
  /\b(remember|prefer|always|never|avoid|use tabs|use spaces|remember that)\b/i,
];

const STYLE_WORDS = ["tab", "espacio", "space", "indent", "comilla", "quote", "estilo", "style", "formato", "format", "mayus", "minus"];

export interface DistillResult {
  saved: number;
  promoted: number;
}

/**
 * Heuristic end-of-session distillation (no LLM calls, no quota cost):
 * scans user turns for stated preferences/conventions and stores them as
 * global notes + global.md lines. Returns counts for logging.
 */
export async function distillSessionToGlobal(
  turns: { role: string; content: string }[],
  opts: { projectTag?: string } = {}
): Promise<DistillResult> {
  let saved = 0;
  const userTurns = turns.filter((t) => t.role === "user" && t.content.trim().length >= 20).slice(-30);
  for (const turn of userTurns) {
    if (saved >= 3) break;
    const text = turn.content.trim();
    if (!PREF_PATTERNS.some((re) => re.test(text))) continue;
    const lower = text.toLowerCase();
    const category = STYLE_WORDS.some((w) => lower.includes(w)) ? "convention" : "preference";
    const tags = Array.from(
      new Set([
        "global",
        "distilled",
        ...(opts.projectTag ? [opts.projectTag] : []),
        ...text.toLowerCase().split(/[^a-z0-9áéíóúñü]+/i).filter((w) => w.length > 4).slice(0, 6),
      ])
    );
    const stored = await rememberNote({
      category,
      tags,
      title: text.slice(0, 60).replace(/\n/g, " "),
      body: text.slice(0, 300),
    });
    if (stored) {
      saved++;
      await rememberGlobal([`${text.slice(0, 160)}`]);
    }
  }
  const promoted = await promoteRepeatedPatterns();
  return { saved, promoted };
}

/**
 * Promotes globally-repeated patterns: when ONE note carries 3+ DISTINCT
 * project tags (same content seen across projects — dedup merges tags into
 * the survivor), it is a cross-project user pattern and gets written to
 * global.md once (the note is marked promoted).
 */
export async function promoteRepeatedPatterns(): Promise<number> {
  const notes = await loadNotes();
  let promoted = 0;
  let dirty = false;
  for (const n of notes) {
    if (n.promoted) continue;
    const projects = new Set<string>();
    for (const t of n.tags) if (t.startsWith("project:")) projects.add(t);
    if (projects.size >= 3) {
      const added = await rememberGlobal([
        `[patrón en ${projects.size} proyectos] ${n.title} — ${n.body.slice(0, 140)}`,
      ]);
      if (added > 0) {
        n.promoted = true;
        dirty = true;
        promoted++;
      }
    }
  }
  if (dirty) await saveNotes(notes);
  return promoted;
}

/**
 * Importance filter for project memory (AGENTS.md): skip trivial tasks to
 * avoid noise. Sensitive work and high levels always pass.
 */
export function shouldRememberProject(prompt: string, level: string, sensitive: boolean): boolean {
  if (sensitive) return true;
  if (level === "high" || level === "max") return true;
  if (prompt.trim().length >= 24) return true;
  return /(decid|convenci|arquitect|migrat|deplo|important|cr[ií]tic|acuerdo|elegi|policy|seguridad|auth|base de datos|schema|refactor|breaking|diseño|presupuesto)/i.test(prompt);
}

export interface CompiledMemory {
  project: string;
  global: string;
  notes: MemoryNote[];
  /** Notes already serialized + filtered for the prefix. */
  noteLines: string[];
}

export interface MemoryOpts {
  cwd: string;
  /** Max notes kept per category before consolidation. */
  maxPerCategory?: number;
}

const DEFAULT_MAX = 25;
const HOMEDIR = homedir();

function globalDir(): string {
  return join(HOMEDIR, ".noirarc", "memory");
}

function notesFile(): string {
  return join(globalDir(), "notes.json");
}

async function readIfExists(p: string): Promise<string> {
  try {
    return await readFile(p, "utf8");
  } catch {
    return "";
  }
}

function normalize(text: string): string {
  return (text ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Basic keyword overlap similarity in [0,1]. Used to dedupe near-identical notes. */
function similarity(a: string, b: string): number {
  const wa = new Set(normalize(a).split(/[^a-z0-9\u00e0-\u00ff]+/).filter(Boolean));
  const wb = new Set(Array.from(wa).length ? normalize(b).split(/[^a-z0-9\u00e0-\u00ff]+/).filter(Boolean) : []);
  if (!wa.size || !wb.size) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / Math.max(wa.size, wb.size);
}

async function loadNotes(): Promise<MemoryNote[]> {
  try {
    const raw = await readFile(notesFile(), "utf8");
    const parsed = JSON.parse(raw) as MemoryNote[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveNotes(notes: MemoryNote[]): Promise<void> {
  await mkdir(globalDir(), { recursive: true });
  await writeFile(notesFile(), JSON.stringify(notes, null, 2), "utf8");
}

/**
 * Adds a note, consolidating first: near-identical notes (same category + high
 * similarity) are merged instead of duplicated, and each category is capped at
 * maxPerCategory keeping the most recent. Returns true if something was stored.
 */
export async function rememberNote(
  input: Omit<MemoryNote, "id" | "createdAt">,
  opts: { maxPerCategory?: number } = {}
): Promise<boolean> {
  const max = opts.maxPerCategory ?? DEFAULT_MAX;
  const notes = await loadNotes();

  // Merge, don't drop: near-identical notes fold their tags (incl. project:
  // tags) into the survivor so cross-project repetition stays visible.
  const droppedTags: string[] = [];
  const merged = notes.filter((n) => {
    const dup =
      n.category === input.category && similarity(n.title + n.body, input.title + input.body) > 0.85;
    if (dup) droppedTags.push(...n.tags);
    return !dup;
  });

  const note: MemoryNote = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
    tags: Array.from(new Set([...input.tags, ...droppedTags])),
  };

  const withNew = [note, ...merged.filter((n) => n.id !== note.id)];

  const capped: MemoryNote[] = [];
  const perCat = new Map<string, number>();
  for (const n of withNew) {
    const c = perCat.get(n.category) ?? 0;
    if (c < max) {
      capped.push(n);
      perCat.set(n.category, c + 1);
    }
  }

  await saveNotes(capped);
  return capped.some((n) => n.id === note.id);
}

/** Computes relevance of a note to the current task using tag + body keywords. */
function relevant(note: MemoryNote, prompt: string): boolean {
  if (!prompt) return true;
  const p = normalize(prompt);
  for (const t of note.tags) {
    if (t.length > 0 && p.includes(normalize(t))) return true;
  }
  for (const w of note.tags) {
    for (const token of p.split(/[^a-z0-9]+/).filter((x) => x.length > 3)) {
      if (token.startsWith(normalize(w)) || normalize(w).startsWith(token)) return true;
    }
  }
  return false;
}

/**
 * Compiles the full hierarchical memory for a task and returns the pieces to
 * inject into the cacheable system prefix.
 */
export async function compileMemory(opts: MemoryOpts & { prompt: string }): Promise<CompiledMemory> {
  const { cwd, prompt } = opts;

  let project = "";
  try {
    project = await readIfExists(join(cwd, "AGENTS.md"));
  } catch {
    project = "";
  }
  // Incluye Cursor/Copilot rules si existen (como pide la instrucción de 20 líneas) — lee todo .cursor/rules/*
  const extraRules: string[] = [];
  for (const p of [join(cwd, ".cursorrules"), join(cwd, ".github", "copilot-instructions.md")]) {
    const t = await readIfExists(p);
    if (t) extraRules.push(t);
  }
  try {
    const { readdir } = await import("node:fs/promises");
    const d = join(cwd, ".cursor", "rules");
    const files = await readdir(d).catch(() => []);
    for (const f of files) {
      if (f.endsWith(".mdc") || f.endsWith(".md")) {
        const t = await readIfExists(join(d, f));
        if (t) extraRules.push(t);
      }
    }
  } catch {}
  const rulesText = extraRules.join("\n\n").trim();
  if (rulesText) project = project ? `${project}\n\n# Reglas Cursor/Copilot\n${rulesText.slice(0, 4000)}` : `# Reglas Cursor/Copilot\n${rulesText.slice(0, 4000)}`;

  let global = "";
  try {
    global = await readIfExists(join(globalDir(), "global.md"));
  } catch {
    global = "";
  }

  const allNotes = await loadNotes();
  // Prioriza notas recientes si el prompt es largo (como la instrucción de 20 líneas)
  const notesFiltered = allNotes.filter((n) => relevant(n, prompt)).slice(0, 8);

  const noteLines = notesFiltered.map((n) => {
    const tag = n.tags.join(", ");
    return `- [${n.category}] ${n.title}${tag ? ` (${tag})` : ""}: ${n.body.slice(0, 200)}`;
  });

  return { project: project.slice(0, 6000), global: global.slice(0, 2000), notes: notesFiltered, noteLines };
}
