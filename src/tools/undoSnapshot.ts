/**
 * Real snapshot-based undo/redo.
 *
 * Automatic snapshot before EVERY edit/write/delete: content is stored under
 * <cwd>/.noira/undo/, so a user's work can always be restored even mid-project.
 * undo/redo are two stacks persisted on disk (survive restarts).
 *
 * Replaces the old `git checkout -- .` fallback that silently wiped unrelated
 * user changes.
 */
import { readFile, writeFile, readdir, mkdir, rm } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { createHash } from "node:crypto";

export interface Snapshot {
  id: string;
  ts: number;
  path: string;
  /** Content BEFORE the change (null if the file did not exist yet). */
  content: string | null;
  /** Content AFTER the change (recorded by the mutating tool). */
  after?: string | null;
  action: "write" | "edit" | "delete_file";
}

function undoDir(cwd: string): string {
  return join(cwd, ".noira", "undo");
}

function sha(s: string): string {
  return createHash("sha1").update(s).digest("hex").slice(0, 12);
}

/** Persist a snapshot entry to its own JSON file + the undo stack. */
export async function takeSnapshot(cwd: string, path: string, action: Snapshot["action"]): Promise<Snapshot> {
  const dir = undoDir(cwd);
  await mkdir(dir, { recursive: true });
  let content: string | null = null;
  try {
    content = await readFile(resolve(path), "utf8");
  } catch {
    content = null; // file did not exist -> undo means "delete it later"
  }
  const id = `${Date.now()}-${sha(`${resolve(path)}@${size(content)}`)}`;
  const entry: Snapshot = { id, ts: Date.now(), path: resolve(path), content, action };
  await writeFile(join(dir, `${id}.json`), JSON.stringify(entry, null, 2), "utf8");
  await pushStack(cwd, "undo", entry);
  await shrink(cwd);
  return entry;
}

/** Record the post-mutation content so redo can replay it exactly. */
export async function recordAfterContent(cwd: string, snapshot: Snapshot, afterContent: string | null): Promise<void> {
  const entry = { ...snapshot, after: afterContent };
  const file = join(undoDir(cwd), `${snapshot.id}.json`);
  await writeFile(file, JSON.stringify(entry, null, 2), "utf8");
  // update the undo stack entry's after field too
  const stacks = await readMeta(cwd);
  const i = stacks.undo.findIndex((s) => s.id === snapshot.id);
  if (i !== -1) stacks.undo[i] = { ...stacks.undo[i], after: afterContent };
  await writeMeta(cwd, stacks);
}

// --- stacks ---------------------------------------------------------------
async function readMeta(cwd: string): Promise<{ undo: Snapshot[]; redo: Snapshot[] }> {
  try {
    return JSON.parse(await readFile(join(undoDir(cwd), "stacks.json"), "utf8"));
  } catch {
    return { undo: [], redo: [] };
  }
}

async function writeMeta(cwd: string, stacks: { undo: Snapshot[]; redo: Snapshot[] }): Promise<void> {
  await mkdir(undoDir(cwd), { recursive: true });
  stacks.undo = stacks.undo.slice(-50);
  stacks.redo = stacks.redo.slice(-50);
  await writeFile(join(undoDir(cwd), "stacks.json"), JSON.stringify(stacks, null, 2), "utf8");
}

async function pushStack(cwd: string, kind: "undo" | "redo", entry: Snapshot): Promise<void> {
  const stacks = await readMeta(cwd);
  stacks[kind].push({ ...entry, after: entry.after ?? null });
  if (kind === "undo") stacks.redo = []; // new change invalidates redo history
  await writeMeta(cwd, stacks);
}

async function shrink(cwd: string): Promise<void> {
  // Keep snapshot files bounded (purge all but the latest 150 by mtime).
  try {
    const files = await readdir(undoDir(cwd));
    const json = files.filter((f) => f.endsWith(".json") && f !== "stacks.json");
    if (json.length <= 150) return;
    const toDelete = json.slice(0, json.length - 150);
    for (const f of toDelete) await rm(join(undoDir(cwd), f), { force: true });
  } catch { /* best effort */ }
}

function size(s: string | null): string {
  return s == null ? "absent" : `${s.length}`;
}

export interface UndoResult {
  ok: boolean;
  message: string;
  file?: string;
}

/** Restore the most recent snapshot (undo). */
export async function doUndo(cwd: string): Promise<UndoResult> {
  const stacks = await readMeta(cwd);
  const snapshot = stacks.undo.pop();
  if (!snapshot) return { ok: false, message: "Nada que deshacer (sin snapshots automaticos)." };
  try {
    if (snapshot.content === null) {
      await rm(resolve(snapshot.path), { force: true });
    } else {
      await mkdir(dirname(resolve(snapshot.path)), { recursive: true });
      await writeFile(resolve(snapshot.path), snapshot.content, "utf8");
    }
  } catch (e) {
    stacks.undo.push(snapshot); // rollback stack on failure
    await writeMeta(cwd, stacks);
    return { ok: false, message: `[undo] fallo: ${e instanceof Error ? e.message : String(e)}` };
  }
  stacks.redo.push(snapshot);
  stacks.redo = stacks.redo.slice(-50);
  await writeMeta(cwd, stacks);
  return { ok: true, message: `[undo] restaurado (${snapshot.action}): ${snapshot.path}`, file: snapshot.path };
}

/** Reapply the last undone change (redo). */
export async function doRedo(cwd: string): Promise<UndoResult> {
  const stacks = await readMeta(cwd);
  const snapshot = stacks.redo.pop();
  if (!snapshot) return { ok: false, message: "Nada que rehacer." };
  try {
    if (snapshot.after === null) {
      await rm(resolve(snapshot.path), { force: true });
    } else if (snapshot.after !== undefined) {
      await mkdir(dirname(resolve(snapshot.path)), { recursive: true });
      await writeFile(resolve(snapshot.path), snapshot.after, "utf8");
    } else {
      return { ok: false, message: "[redo] sin estado 'despues' para este snapshot." };
    }
  } catch (e) {
    stacks.redo.push(snapshot);
    await writeMeta(cwd, stacks);
    return { ok: false, message: `[redo] fallo: ${e instanceof Error ? e.message : String(e)}` };
  }
  stacks.undo.push({ ...snapshot, after: snapshot.after ?? null });
  stacks.undo = stacks.undo.slice(-50);
  await writeMeta(cwd, stacks);
  return { ok: true, message: `[redo] reaplicado: ${snapshot.path}`, file: snapshot.path };
}

export function snapshotDir(cwd: string): string {
  return undoDir(cwd);
}