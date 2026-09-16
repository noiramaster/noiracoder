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
- Estilo NoiraX: negro #000 + amarillo #f9e2af + magenta #D63384
- Prefijos: > [ok] [error] [warn]; voz cálida pro, no seca
- Memoria: AGENTS.md + .noirarc/memory/* + skills/ (SKILL.md)

## Noira — decisiones
`;
    await mkdir(join(this.file, ".."), { recursive: true });
    await writeFile(this.file, tpl, "utf8");
    this.loaded = tpl;
  }
}
