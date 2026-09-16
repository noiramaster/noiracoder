/**
 * Interactive approval prompts for sensitive actions (file deletion, deploy,
 * git push). Noira never performs these without explicit confirmation.
 *
 * Uses readline against the terminal. Supports a TTY and a piped (non-TTY)
 * fallback that reads a single line from stdin with a timeout.
 */

import { createInterface } from "node:readline";
import type { PromptOptions } from "../types.js";

export async function confirm(msg: string, opts?: PromptOptions): Promise<boolean> {
  const line = await prompt(`${msg} [y/N] `, opts);
  const t = (line ?? "").trim().toLowerCase();
  return t === "y" || t === "yes";
}

export async function prompt(question: string, opts?: PromptOptions): Promise<string> {
  const timeoutMs = opts?.timeoutMs;
  if (process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    let timer: NodeJS.Timeout | undefined;
    const done = (val: string) => {
      clearTimeout(timer);
      rl.close();
    };
    return new Promise<string>((resolve) => {
      if (timeoutMs) {
        timer = setTimeout(() => {
          rl.close();
          resolve("");
        }, timeoutMs);
      }
      rl.question(question, (answer) => {
        done(answer);
        resolve(answer);
      });
    });
  }

  // Non-TTY: read one line from stdin with timeout.
  let buffer = "";
  let timer: NodeJS.Timeout | undefined;
  if (timeoutMs) {
    timer = setTimeout(() => {
      process.stdin.removeAllListeners("data");
      process.stdin.pause();
    }, timeoutMs);
  }
  return new Promise<string>((resolve) => {
    process.stdin.setEncoding("utf8");
    const onData = (d: string) => {
      buffer += d;
    };
    process.stdin.on("data", onData);
    const flush = () => {
      clearTimeout(timer);
      process.stdin.removeListener("data", onData);
      const idx = buffer.indexOf("\n");
      resolve(idx >= 0 ? buffer.slice(0, idx) : buffer);
    };
    if (!timeoutMs) {
      process.stdin.once("end", flush);
    } else {
      setTimeout(flush, timeoutMs);
    }
  });
}
