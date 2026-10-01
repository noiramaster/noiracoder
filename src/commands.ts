/**
 * B2: comandos personalizados (~/.noirarc/commands/*.md).
 *
 * Formato de cada fichero:
 *   # nombre-del-comando
 *   desc: una línea para /cmds
 *   ---
 *   plantilla del prompt, con {args} donde van los argumentos
 *
 * `/cmd <nombre> [args...]` lo expande y lo envía como un turno NORMAL:
 * mismas confirmaciones, mismo sandbox, sin saltarse nada. Solo agrupa
 * pasos ya permitidos en una sola orden.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import os from "node:os";

export interface CustomCmdDef {
  nombre: string;
  desc: string;
  run: string;
}

export function commandsDir(): string {
  return join(process.env.NOIRARC_HOME ?? os.homedir(), ".noirarc", "commands");
}

export async function loadCommands(): Promise<CustomCmdDef[]> {
  let files: string[] = [];
  try {
    files = (await readdir(commandsDir())).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
  const out: CustomCmdDef[] = [];
  for (const f of files) {
    try {
      const raw = await readFile(join(commandsDir(), f), "utf8");
      const nombre = (raw.match(/^#\s*(.+)$/m)?.[1] ?? f.replace(/\.md$/, ""))
        .trim().toLowerCase().replace(/\s+/g, "-");
      if (!/^[a-z0-9_-]{1,40}$/.test(nombre)) continue;
      const desc = (raw.match(/^desc:\s*(.+)$/m)?.[1] ?? "").trim().slice(0, 120);
      const run = raw.split(/^---\s*$/m)[1]?.trim() ?? "";
      if (!run) continue;
      out.push({ nombre, desc, run });
    } catch { /* fichero roto: se salta, nunca bloquea */ }
  }
  return out.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export function expandCmd(def: CustomCmdDef, args: string): string {
  return def.run.replace(/\{args\}/g, args).slice(0, 4000);
}
