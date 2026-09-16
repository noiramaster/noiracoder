/**
 * SKILL.md compatibility: discover skills (Claude Code / OpenCode
 * format) and resolve the most relevant ones for a given task.
 *
 * The bundled base skills (packaged under the app's `skills/` dir) are ALWAYS
 * available regardless of the working directory; project skills (cwd/skills,
 * cwd/.noira/skills) and the user's global skills (~/.noirarc/skills) are
 * layered on top.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

export interface Skill {
  name: string;
  description: string;
  dir: string;
  body: string;
}

interface Frontmatter {
  name?: string;
  description?: string;
  [key: string]: unknown;
}

/** Directory of the bundled base skills — see comment above. */
export function baseSkillsDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, "..", "..", "skills"),
    path.join(here, "..", "skills"),
  ];
  return candidates[0];
}

function globalSkillsDir(): string {
  const home = process.env.NOIRARC_HOME ?? os.homedir();
  return path.join(home, ".noirarc", "skills");
}

/**
 * Recursively find directories containing a SKILL.md. Always includes the
 * bundled base skills plus: `dir/skills/`, `dir/.noira/skills/`, and the
 * user's global `~/.noirarc/skills/`.
 */
export async function discoverSkills(dir: string): Promise<Skill[]> {
  const roots = [
    baseSkillsDir(),
    globalSkillsDir(),
    path.join(dir, "skills"),
    path.join(dir, ".noira", "skills"),
  ];
  const found: Skill[] = [];
  const seen = new Set<string>();

  for (const root of roots) {
    if (await exists(root)) {
      await walk(root, found, seen, true);
    }
  }
  return found;
}

async function walk(dir: string, out: Skill[], seen: Set<string>, _top: boolean): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const skillMd = path.join(full, "SKILL.md");
      if (await exists(skillMd)) {
        if (seen.has(full)) continue;
        seen.add(full);
        out.push(await parseSkillDir(full, skillMd));
      } else {
        await walk(full, out, seen, false);
      }
    }
  }
}

async function parseSkillDir(dir: string, skillMd: string): Promise<Skill> {
  const raw = await fs.readFile(skillMd, "utf8");
  const fm = parseFrontmatter(raw);
  return {
    name: fm.name ?? path.basename(dir),
    description: fm.description ?? "",
    dir,
    body: fm.body,
  };
}

function parseFrontmatter(raw: string): Frontmatter & { body: string } {
  const fm: Frontmatter = {};
  let body = raw.trim();
  const lines = raw.split(/\r?\n/);
  if (lines[0]?.trim() === "---") {
    const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
    if (end !== -1) {
      const yamlLines = lines.slice(1, end);
      for (const line of yamlLines) {
        const m = line.match(/^([A-Za-z0-9_]+)\s*:\s*(.*)$/);
        if (!m) continue;
        const key = m[1];
        let value: string = m[2].trim();
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        fm[key] = value;
      }
      body = lines.slice(end + 1).join("\n").trim();
    }
  }
  return { ...fm, body };
}

/**
 * Return the full SKILL.md contents (frontmatter + body) so it can be
 * injected into the agent context.
 */
export async function loadSkill(skill: Skill): Promise<string> {
  const skillMd = path.join(skill.dir, "SKILL.md");
  return fs.readFile(skillMd, "utf8");
}

const MAX_RESULTS = 3;

/**
 * Simple term-frequency (TFR) keyword matcher: score each skill
 * description against the task words, return the top matching
 * skill bodies so only relevant skills enter context.
 */
export function resolveSkillInstruction(skills: Skill[], task: string): string[] {
  const taskWords = new Set(tokenize(task));
  if (taskWords.size === 0) return [];

  const scored = skills
    .map((skill) => {
      const searchText = `${skill.name} ${skill.description} ${skill.body}`;
      const words = tokenize(searchText);
      const freq = new Map<string, number>();
      for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
      let score = 0;
      for (const w of taskWords) {
        score += freq.get(w) ?? 0;
      }
      return { skill, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, MAX_RESULTS).map((s) => s.skill.body);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 0);
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
