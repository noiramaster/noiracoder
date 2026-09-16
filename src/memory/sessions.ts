/**
 * Persistent session store for interactive ("noira") sessions.
 *
 * Each conversation is persisted as a series of exchanges under
 * ~/.noirarc/sessions/<safe-dir>/<session-id>.json. This lets the REPL resume
 * a previous conversation (Claude Code's /resume) or keep context across
 * turns within the same session, surviving restarts.
 */

import { mkdir, readFile, readdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";

export interface SessionTurn {
  role: "user" | "assistant";
  content: string;
  ts: string;
}

export interface SessionMeta {
  id: string;
  cwd: string;
  level: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  turns: SessionTurn[];
}

function sessionsDir(): string {
  const home = process.env.NOIRARC_HOME ?? homedir();
  return join(home, ".noirarc", "sessions");
}

/** Safe directory key derived from a working directory (stable, filesystem-safe). */
export function dirKey(cwd: string): string {
  const cleaned = cwd.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[-]+|[-]+$/g, "");
  return cleaned || "root";
}

function metaPath(cwd: string, id: string): string {
  return join(sessionsDir(), dirKey(cwd), `${id}.json`);
}

export class SessionStore {
  private readonly base: string;

  constructor(cwd: string) {
    this.base = join(sessionsDir(), dirKey(cwd));
  }

  async list(): Promise<SessionMeta[]> {
    try {
      const files = await readdir(this.base);
      const metas: SessionMeta[] = [];
      for (const f of files) {
        if (!f.endsWith(".json")) continue;
        try {
          const raw = await readFile(join(this.base, f), "utf8");
          const m = JSON.parse(raw) as SessionMeta;
          if (m && m.id) metas.push(m);
        } catch {
          // skip malformed
        }
      }
      return metas.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    } catch {
      return [];
    }
  }

  async create(level: string, cwd: string, title?: string): Promise<SessionMeta> {
    const meta: SessionMeta = {
      id: randomUUID(),
      cwd,
      level,
      title: title ?? "new session",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      turns: [],
    };
    await mkdir(this.base, { recursive: true });
    await writeFile(metaPath(cwd, meta.id), JSON.stringify(meta, null, 2), "utf8");
    return meta;
  }

  async load(id: string): Promise<SessionMeta | null> {
    try {
      const raw = await readFile(join(this.base, `${id}.json`), "utf8");
      return JSON.parse(raw) as SessionMeta;
    } catch {
      return null;
    }
  }

  private async save(meta: SessionMeta, cwd: string): Promise<void> {
    await mkdir(this.base, { recursive: true });
    await writeFile(metaPath(cwd, meta.id), JSON.stringify(meta, null, 2), "utf8");
  }

  async append(meta: SessionMeta, role: SessionTurn["role"], content: string): Promise<SessionMeta> {
    meta.turns.push({ role, content, ts: new Date().toISOString() });
    meta.updatedAt = new Date().toISOString();
    if (role === "user" && meta.turns.filter((t) => t.role === "user").length === 1) {
      meta.title = content.slice(0, 60).replace(/\n/g, " ").trim() || "new session";
    }
    await this.save(meta, meta.cwd);
    return meta;
  }

  async remove(id: string, cwd: string): Promise<void> {
    try {
      await rm(metaPath(cwd, id), { force: true });
    } catch {
      // ignore
    }
  }

  /** Builds a compact conversational tail for context injection. */
  static tail(meta: SessionMeta, n = 6): string {
    const recent = meta.turns.slice(-n);
    if (!recent.length) return "";
    return recent
      .map((t) => `${t.role === "user" ? "Usuario" : "Noira"}: ${t.content.slice(0, 500)}`)
      .join("\n");
  }
}
