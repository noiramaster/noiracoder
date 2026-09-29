/**
 * H1 — aprendizaje local (SOLO metadatos, nunca código del usuario).
 * Registra por turno: tipo de tarea, nivel EFECTIVO, modelo real, reintentos,
 * herramientas usadas (nombres), duración, éxito y deshechos posteriores.
 * Recomputa reglas (qué nivel por defecto por tipo) con umbrales honestos y
 * las aplica automáticamente. LÍMITE DURO (H1.5): este módulo solo lee/escribe
 * learn/turns.jsonl, learn/learned.json y memory/learned.md. No importa ni
 * toca el sandbox, las aprobaciones ni la lista blanca (lo verifica test/learn.mjs).
 */
import { appendFile, mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Level } from "../types.js";

export type TaskType = "consulta" | "codigo" | "comandos" | "mixto";

export interface TurnRecord {
  v: 1;
  at: string;
  session: string;
  task: TaskType;
  level: string;
  model: string;
  retries: number;
  ms: number;
  ok: boolean;
  tools: string[];
}

export interface UndoMark {
  v: 1;
  at: string;
  session: string;
  kind: "undo";
}

export interface LearnedRules {
  v: 1;
  updatedAt: string;
  lastCount: number;
  defaultLevelByTask: Record<string, { level: string; n: number; okRate: number; p50ms: number }>;
}

function learnDir(): string {
  const home = process.env.NOIRARC_HOME ?? homedir();
  return join(home, ".noirarc", "learn");
}
function turnsFile(): string {
  return join(learnDir(), "turns.jsonl");
}
function rulesFile(): string {
  return join(learnDir(), "learned.json");
}
function auditFile(): string {
  const home = process.env.NOIRARC_HOME ?? homedir();
  return join(home, ".noirarc", "memory", "learned.md");
}

/** Clasifica SIN guardar el prompt (solo vive en memoria). */
export function classifyTask(message: string, toolsUsed: string[] = []): TaskType {
  const m = message.toLowerCase();
  // "ejecuta los tests" habla de correr, no de escribir código: no cuenta "test".
  const mNoRun = m.replace(/\b(ejecuta(r)?|corre(r)?|lanza(r)?|corre\b)[^.]*\btests?\b/g, " ");
  const hasCode = /(\.(ts|js|tsx|jsx|py|go|rs|java|md|json|css|html)\b|```|funci[oó]n|clase|refactor|\btests?\b|bug|error|fix|crea|añade|edita|escribe.*(c[oó]digo|funci[oó]n|test)|import|export|const |def |fn )/.test(mNoRun);
  const hasCmd = /(ejecuta|corre|comando|deploy|git |docker|npm |instal|compila|corre.*test|shell|bash)/.test(m);
  const toolCode = toolsUsed.some((t) => /^(write|edit|read|list)$/.test(t));
  const toolCmd = toolsUsed.some((t) => /^(bash|deploy|git)$/.test(t));
  const isQuestion = /(^|\s)(qu[eé]|c[oó]mo|por qu[eé]|cu[aá]ndo|d[oó]nde|explica|what|how|why|which|\?)/.test(m);
  const code = hasCode || toolCode;
  const cmd = hasCmd || toolCmd;
  if (code && cmd) return "mixto";
  if (code) return "codigo";
  if (cmd) return "comandos";
  if (isQuestion || toolsUsed.length === 0) return "consulta";
  return "mixto";
}

export async function recordTurn(rec: Omit<TurnRecord, "v" | "at">): Promise<void> {
  try {
    await mkdir(learnDir(), { recursive: true });
    const line = JSON.stringify({ v: 1, at: new Date().toISOString(), ...rec }) + "\n";
    await appendFile(turnsFile(), line, "utf8");
  } catch { /* aprender nunca rompe un turno */ }
}

export async function recordUndo(session: string): Promise<void> {
  try {
    await mkdir(learnDir(), { recursive: true });
    const mark: UndoMark = { v: 1, at: new Date().toISOString(), session, kind: "undo" };
    await appendFile(turnsFile(), JSON.stringify(mark) + "\n");
  } catch { /* nunca rompe */ }
}

export async function loadTurns(): Promise<TurnRecord[]> {
  try {
    const raw = await readFile(turnsFile(), "utf8");
    const out: TurnRecord[] = [];
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      try {
        const o = JSON.parse(t) as Record<string, unknown>;
        if (o.v === 1 && typeof o.task === "string" && typeof o.session === "string" && !("kind" in o)) {
          out.push(o as unknown as TurnRecord);
        }
      } catch { /* línea corrupta/envenenada: se ignora (H1.5) */ }
    }
    return out;
  } catch {
    return [];
  }
}

export interface TaskStats {
  n: number;
  okRate: number;
  p50ms: number;
  byLevel: Record<string, { n: number; okRate: number; p50ms: number }>;
}

function p50(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

export function computeStats(turns: TurnRecord[]): Record<TaskType, TaskStats> {
  const out = {} as Record<TaskType, TaskStats>;
  for (const task of ["consulta", "codigo", "comandos", "mixto"] as TaskType[]) {
    const ts = turns.filter((t) => t.task === task);
    const acc: Record<string, { n: number; ok: number; ms: number[] }> = {};
    for (const t of ts) {
      const b = (acc[t.level] ??= { n: 0, ok: 0, ms: [] });
      b.n++;
      if (t.ok) b.ok++;
      b.ms.push(t.ms);
    }
    const levels: TaskStats["byLevel"] = {};
    for (const [lv, b] of Object.entries(acc)) {
      levels[lv] = { n: b.n, okRate: b.n ? b.ok / b.n : 0, p50ms: p50(b.ms) };
    }
    out[task] = {
      n: ts.length,
      okRate: ts.length ? ts.filter((t) => t.ok).length / ts.length : 0,
      p50ms: p50(ts.map((t) => t.ms)),
      byLevel: levels,
    };
  }
  return out;
}

export const MIN_TURNS = 6;
export const MIN_MARGIN = 0.1;

export async function getLearned(): Promise<LearnedRules | null> {
  try {
    const raw = await readFile(rulesFile(), "utf8");
    const o = JSON.parse(raw) as LearnedRules;
    if (o.v === 1 && o.defaultLevelByTask) return o;
    return null;
  } catch {
    return null;
  }
}

/** Recomputa reglas con umbrales; solo escribe learned.json + learned.md. */
export async function recomputeRules(reason: string): Promise<LearnedRules | null> {
  const turns = await loadTurns();
  const stats = computeStats(turns);
  const prev = await getLearned();
  const rules: LearnedRules = {
    v: 1,
    updatedAt: new Date().toISOString(),
    lastCount: turns.length,
    defaultLevelByTask: { ...(prev?.defaultLevelByTask ?? {}) },
  };
  const changes: string[] = [];
  for (const [task, st] of Object.entries(stats) as Array<[TaskType, TaskStats]>) {
    if (st.n < MIN_TURNS) continue;
    const cands = Object.entries(st.byLevel).filter(([, b]) => b.n >= 3);
    if (!cands.length) continue;
    cands.sort((a, b) => b[1].okRate - a[1].okRate || a[1].p50ms - b[1].p50ms);
    const [bestLv, best] = cands[0];
    const cur = rules.defaultLevelByTask[task]?.level ?? "medium";
    if (bestLv !== cur && best.okRate - (st.byLevel[cur]?.okRate ?? st.okRate) >= MIN_MARGIN) {
      rules.defaultLevelByTask[task] = { level: bestLv, n: st.n, okRate: best.okRate, p50ms: best.p50ms };
      changes.push(`- ${task}: ${cur} → ${bestLv} (n=${st.n}, ok=${Math.round(best.okRate * 100)}%, p50=${best.p50ms}ms)`);
    }
  }
  try {
    await mkdir(learnDir(), { recursive: true });
    await writeFile(rulesFile(), JSON.stringify(rules, null, 2) + "\n", "utf8");
    const head = `# Aprendizajes (H1: automático, trazable, reversible)\n\n`;
    let prevMd = "";
    try {
      prevMd = await readFile(auditFile(), "utf8");
    } catch { /* primera vez */ }
    const entry =
      `\n## ${rules.updatedAt} — ${reason} (turnos=${turns.length})\n` +
      (changes.length ? changes.join("\n") + "\n" : "- sin cambios (sin muestra o sin margen)\n");
    await mkdir(join(learnDir(), "..", "memory"), { recursive: true });
    await writeFile(auditFile(), (prevMd.startsWith("# Aprendizajes") ? prevMd : head + prevMd) + entry, "utf8");
  } catch { /* nunca rompe */ }
  return rules;
}

/** Nivel efectivo: explícito del usuario manda; si no, regla aprendida. */
export function resolveLevel(task: TaskType, explicit: string | null, rules: LearnedRules | null, fallback: string): string {
  if (explicit) return explicit;
  return rules?.defaultLevelByTask[task]?.level ?? fallback;
}
