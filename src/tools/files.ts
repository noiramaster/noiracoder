/**
 * File editing tools: read, write, edit (string replace), list files.
 * These drive the model's code-editing ability.
 */

import { readFile, writeFile, mkdir, rm, stat, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ToolDefinition, ToolCallContext } from "./index.js";
import { params } from "./index.js";
import { takeSnapshot, recordAfterContent } from "./undoSnapshot.js";

interface ReadArgs {
  path: string;
  offset?: number;
  limit?: number;
  maxChars?: number;
}
interface WriteArgs {
  path: string;
  content: string;
}
interface EditArgs {
  path: string;
  oldString: string;
  newString: string;
}
interface DeleteArgs {
  path: string;
}
interface ListArgs {
  path?: string;
}

export function readTool(): ToolDefinition<ReadArgs> {
  return {
    name: "read",
    description:
      "Lee un archivo (texto). Opciones: offset (linea 1-indexed), limit (lineas), maxChars. Devuelve el contenido con numeros de linea.",
    parameters: params({
      path: { type: "string", description: "Ruta relativa (al cwd de la sesion) o absoluta al archivo" },
      offset: { type: "number", description: "Numero de linea de inicio (1-indexed)" },
      limit: { type: "number", description: "Maximo de lineas a devolver" },
      maxChars: { type: "number", description: "Cap de caracteres de salida" },
    }),
    async handler(args: ReadArgs, ctx: ToolCallContext) {
      const p = resolve(ctx.cwd, args.path);
      const stat = await import("node:fs/promises").then((m) => m.stat(p).catch(() => null));
      if (stat && stat.size > 500000) {
        throw new Error(`${args.path} muy grande (${Math.round(stat.size / 1024)}KB), usa offset/limit`);
      }
      const content = await readFile(p, "utf8").catch((e) => {
        const msg = e.code === "ENOENT" ? `No existe ${args.path}` : e.code === "EISDIR" ? `${args.path} es directorio, usa list` : `No pude leer ${args.path}: ${e.message}`;
        throw new Error(msg);
      });
      if (content.includes("\0")) throw new Error(`${args.path} es binario, no legible como texto`);
      const lines = content.split("\n");
      const offset = Math.max(1, args.offset ?? 1);
      const limit = Math.min(args.limit ?? lines.length, 2000);
      const slice = lines.slice(offset - 1, offset - 1 + limit);
      let out = slice.map((l, i) => `${offset + i}: ${l}`).join("\n");
      // HITO 2.5: tope por defecto aunque no se pida maxChars (ficheros enormes).
      const cap = args.maxChars ?? 100000;
      if (out.length > cap) {
        out = out.slice(0, cap) + "\n(... [truncado: usa offset/limit])";
      } else if (args.maxChars && out.length > args.maxChars) {
        out = out.slice(0, args.maxChars) + "\n(... [truncado por maxChars])";
      }
      if (lines.length > offset - 1 + limit) out += `\n(... ${lines.length - (offset - 1 + limit)} líneas más, usa offset=${offset + limit})`;
      return out;
    },
  };
}

export function writeTool(): ToolDefinition<WriteArgs> {
  return {
    name: "write",
    description: "Escribe/sobreescribe un archivo con el contenido dado (crea directorios padre si es necesario).",
    parameters: params({
      path: { type: "string", description: "Ruta al archivo (relativa al cwd de la sesion o absoluta)" },
      content: { type: "string", description: "Contenido completo a escribir" },
    }),
    async handler(args: WriteArgs, ctx: ToolCallContext) {
      const p = resolve(ctx.cwd, args.path);
      // Automatic snapshot BEFORE any mutation (real undo).
      const snap = await takeSnapshot(ctx.cwd, p, "write");
      await mkdir(join(p, ".."), { recursive: true });
      await writeFile(p, args.content, "utf8");
      await recordAfterContent(ctx.cwd, snap, args.content);
      return `[ok] escrito ${p} (${args.content.length} chars)`;
    },
  };
}

export function editTool(): ToolDefinition<EditArgs> {
  return {
    name: "edit",
    description:
      "Reemplaza exactamente oldString por newString en un archivo. Usa replaceAll para todas las ocurrencias (añade 'replaceAll': true).",
    parameters: params({
      path: { type: "string", description: "Ruta al archivo (relativa al cwd de la sesion o absoluta)" },
      oldString: { type: "string", description: "Texto exacto a buscar (debe existir)" },
      newString: { type: "string", description: "Texto de reemplazo" },
    }),
    async handler(args: EditArgs, ctx: ToolCallContext) {
      const p = resolve(ctx.cwd, args.path);
      const content = await readFile(p, "utf8").catch((e) => {
        throw new Error(`No pude leer ${args.path}: ${e.message}`);
      });
      const idx = content.indexOf(args.oldString);
      if (idx < 0) {
        throw new Error(`oldString no encontrado en ${args.path}`);
      }
      // Automatic snapshot BEFORE the mutation (real undo).
      const snap = await takeSnapshot(ctx.cwd, p, "edit");
      const next = content.slice(0, idx) + args.newString + content.slice(idx + args.oldString.length);
      await writeFile(p, next, "utf8");
      await recordAfterContent(ctx.cwd, snap, next);
      return `[ok] editado ${p}`;
    },
  };
}

export function deleteTool(): ToolDefinition<DeleteArgs> {
  return {
    name: "delete_file",
    description: "Borra un archivo o directorio. Requiere confirmacion explicita del usuario.",
    parameters: params({ path: { type: "string", description: "Ruta a borrar (relativa al cwd de la sesion o absoluta)" } }),
    async handler(args: DeleteArgs, ctx: ToolCallContext) {
      const p = resolve(ctx.cwd, args.path);
      const sensitive = ctx.isSensitive?.(p) ?? false;
      if (sensitive) {
        throw new Error(
          "[denied] Ruta sensible (definida en la politica del proyecto). Noira no borra aqui sin intervencion manual explicita."
        );
      }
      if (!ctx.confirmDestructive) {
        throw new Error("[denied] La confirmacion destructiva esta deshabilitada. Reintenta con confirmacion.");
      }
      const ok = await ctx.confirm(`¿Borrar ${p}? Esta accion no se puede deshacer. [y/N]`);
      if (!ok) throw new Error("Cancelado por el usuario.");
      const st = await stat(p).catch(() => null);
      if (!st) throw new Error(`No existe ${p}`);
      // Automatic snapshot BEFORE deleting so undo can restore the file.
      const snap = await takeSnapshot(ctx.cwd, p, "delete_file");
      await rm(p, { recursive: st.isDirectory(), force: true });
      await recordAfterContent(ctx.cwd, snap, null);
      return `[ok] borrado ${p}`;
    },
  };
}

export function listTool(): ToolDefinition<ListArgs> {
  return {
    name: "list",
    description: "Lista el contenido de un directorio.",
    parameters: params({ path: { type: "string", description: "Directorio (default: cwd)" } }),
    async handler(args: ListArgs, ctx: ToolCallContext) {
      const p = resolve(args.path ?? ctx.cwd);
      const entries = await readdir(p, { withFileTypes: true }).catch((e) => {
        throw new Error(`No pude listar ${p}: ${e.message}`);
      });
      return entries
        .map((e) => `${e.isDirectory() ? "[d]" : "   "} ${e.name}`)
        .sort()
        .join("\n");
    },
  };
}

export function fileTools(): ToolDefinition<any>[] {
  return [readTool(), writeTool(), editTool(), deleteTool(), listTool()];
}
