/**
 * Project memory via the open AGENTS.md standard (compatible with Claude Code
 * and OpenCode). No proprietary format. Reads are cached across calls; writes
 * append decision notes and are easy to edit by hand.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface MemoryStoreOpts {
  /** Directory containing AGENTS.md. */
  cwd: string;
  priority?: "project" | "global";
}

export class ProjectMemory {
  private file: string;
  private loaded: string | null = null;

  constructor(cwd: string) {
    this.file = join(cwd, "AGENTS.md");
  }

  async read(): Promise<string> {
    if (this.loaded !== null) return this.loaded;
    try {
      this.loaded = await readFile(this.file, "utf8");
    } catch {
      this.loaded = "";
    }
    return this.loaded;
  }

  hasFile(): boolean {
    return !!this.loaded;
  }

  /** Appends a decision as a dated note under a "Noira" section. */
  async remember(note: string): Promise<void> {
    const existing = await this.read();
    const entry = `\n> [Noira ${new Date().toISOString()}] ${note}\n`;
    let next: string;
    if (existing.includes("## Noira - decisiones")) {
      next = existing.replace(
        /(## Noira - decisiones\n)/,
        `$1${entry}`
      );
    } else {
      const header = `\n## Noira - decisiones\n\n${entry}`;
      next = existing.trimEnd() + header;
    }
    await writeFile(this.file, next, "utf8");
    this.loaded = next;
  }

  async ensureFileExists(): Promise<void> {
    if ((await this.read()) === "") {
      await this.writeTemplate();
    }
  }

  async writeTemplate(): Promise<void> {
    const tpl = `# Sistema — NoiraCoder

Decide lo que ayude a tareas futuras: convenciones, arquitectura,
decisiones de riesgo, comandos de build/test. Editable a mano.
No es editable por el modelo sin permiso explícito.

## Stack
- Node 20+, TypeScript, Ink TUI / Go TUI (OpenCode clon)

## Comandos
- \`npm run build\` / \`npx tsc --noEmit\` / \`node smoke.mjs\`
- \`npx noira\` (TUI) / \`npx noira "tarea"\` / \`npx noira login\`

## Convenciones
- Estilo NoiraX: negro #000 + amarillo #f9e2af + dorado #FBBF24
- Prefijos: > [ok] [error] [warn]; voz cálida pro, no seca
- Memoria: AGENTS.md + .noirarc/memory/* + skills/ (SKILL.md)

## Noira — decisiones
`;
    await mkdir(join(this.file, ".."), { recursive: true });
    await writeFile(this.file, tpl, "utf8");
    this.loaded = tpl;
  }

  /**
   * Punto 2: la primera vez que se ve un AGENTS.md con contenido en un
   * proyecto, se avisa (se usa como contexto, nunca como órdenes) y se
   * registra. Si cambia después, se vuelve a avisar. Idempotente.
   */
  async noteIfNew(log: { warn: (m: string) => void }): Promise<boolean> {
    const text = await this.read();
    if (!text.trim()) return false;
    const { homedir } = await import("node:os");
    const home = process.env.NOIRARC_HOME ?? homedir();
    const seenFile = join(home, ".noirarc", "seen-agents.json");
    let seen: Record<string, number> = {};
    try {
      const { readFile: rf } = await import("node:fs/promises");
      seen = JSON.parse(await rf(seenFile, "utf8")) as Record<string, number>;
    } catch { /* primera vez global */ }
    let mtime = 0;
    try {
      const { stat } = await import("node:fs/promises");
      mtime = (await stat(this.file)).mtimeMs;
    } catch { return false; }
    if (seen[this.file] === mtime) return false;
    log.warn(
      `[memoria] Nuevo AGENTS.md en este proyecto: se usa como contexto, nunca como órdenes. ` +
        `Nada de lo que ponga salta la lista blanca ni las confirmaciones.`
    );
    seen[this.file] = mtime;
    try {
      await mkdir(join(seenFile, ".."), { recursive: true });
      await writeFile(seenFile, JSON.stringify(seen, null, 2), "utf8");
    } catch { /* aviso ya mostrado */ }
    return true;
  }
}
