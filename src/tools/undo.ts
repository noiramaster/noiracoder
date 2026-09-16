/**
 * Undo tool — REAL undo/redo using automatic snapshots.
 *
 * Every write/edit/delete takes a snapshot first (see undoSnapshot.ts), so
 * `undo` restores the exact previous file content and `redo` reapplies the
 * change. No `git checkout` fallback exists anymore: that old fallback would
 * silently wipe unrelated user changes.
 */
import type { ToolDefinition, ToolCallContext } from "./index.js";
import { params } from "./index.js";
import { doUndo, doRedo, takeSnapshot, snapshotDir } from "./undoSnapshot.js";
import { resolve } from "node:path";

export function undoTool(): ToolDefinition<{ action: string; path?: string }> {
  return {
    name: "undo",
    description: "Revierte cambios con snapshots automaticos: undo (ultimo cambio), redo (reaplicar), snapshot (forzar captura manual del estado actual)",
    parameters: params({
      action: { type: "string", description: "undo | redo | snapshot | info" },
      path: { type: "string", description: "Archivo a capturar en snapshot (default: ninguno)" },
    }),
    async handler(args, ctx) {
      const action = args.action ?? "undo";
      if (action === "snapshot") {
        try {
          const p = resolve(ctx.cwd, args.path ?? ".");
          await takeSnapshot(ctx.cwd, p, "write");
          return `[ok] snapshot manual guardado de ${p}`;
        } catch (e) {
          return `[error] snapshot: ${e instanceof Error ? e.message : String(e)}`;
        }
      }
      if (action === "undo") {
        const r = await doUndo(ctx.cwd);
        return r.ok ? r.message : `[warn] ${r.message}`;
      }
      if (action === "redo") {
        const r = await doRedo(ctx.cwd);
        return r.ok ? r.message : `[warn] ${r.message}`;
      }
      if (action === "info") {
        return `[info] snapshots guardados en ${snapshotDir(ctx.cwd)}`;
      }
      return "[warn] action desconocido (undo|redo|snapshot|info)";
    },
  };
}