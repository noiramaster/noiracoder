/**
 * Terminal logger matching the Noira identity: prefix-style output,
 * no courtesy filler.
 */

type Channel = "info" | "ok" | "error" | "warn" | "raw";

const PREFIX: Record<Channel, string> = {
  info: ">",
  ok: "[ok]",
  error: "[error]",
  warn: "[warn]",
  raw: "",
};

/** ANSI helpers — dorado de marca SOLO para el logo/welcome; el resto usa colores estándar de terminal. */
export const color = {
  get use(): boolean { return !!process.stdout.isTTY; },
  /** Dorado de marca #FBBF24 — úsalo solo en el arte de bienvenida/logo. */
  gold: (s: string): string => (process.stdout.isTTY ? `\x1b[38;2;251;191;36m${s}\x1b[0m` : s),
  yellow: (s: string): string => (process.stdout.isTTY ? `\x1b[33m${s}\x1b[0m` : s),
  green: (s: string): string => (process.stdout.isTTY ? `\x1b[32m${s}\x1b[0m` : s),
  red: (s: string): string => (process.stdout.isTTY ? `\x1b[31m${s}\x1b[0m` : s),
  dim: (s: string): string => (process.stdout.isTTY ? `\x1b[2m${s}\x1b[0m` : s),
  bold: (s: string): string => (process.stdout.isTTY ? `\x1b[1m${s}\x1b[0m` : s),
  ok: (s: string): string => (process.stdout.isTTY ? `\x1b[32m${s}\x1b[0m` : s),
  error: (s: string): string => (process.stdout.isTTY ? `\x1b[31m${s}\x1b[0m` : s),
  warn: (s: string): string => (process.stdout.isTTY ? `\x1b[33m${s}\x1b[0m` : s),
  cyan: (s: string): string => (process.stdout.isTTY ? `\x1b[36m${s}\x1b[0m` : s),
  magenta: (s: string): string => (process.stdout.isTTY ? `\x1b[35m${s}\x1b[0m` : s),
  white: (s: string): string => (process.stdout.isTTY ? `\x1b[37m${s}\x1b[0m` : s),
  bgYellow: (s: string): string => (process.stdout.isTTY ? `\x1b[43m\x1b[30m${s}\x1b[0m` : s),
  noiraYellow: (s: string): string => color.gold(s),
  noiraMagenta: (s: string): string => (process.stdout.isTTY ? `\x1b[38;2;214;51;132m${s}\x1b[0m` : s),
};

export interface Logger {
  info(msg: string): void;
  ok(msg: string): void;
  error(msg: string): void;
  warn(msg: string): void;
  raw(msg: string): void;
  child(prefix: string): Logger;
}

export function createLogger(out: NodeJS.WritableStream = process.stdout): Logger {
  const emit = (channel: Channel, msg: string): void => {
    const p = PREFIX[channel];
    // Colores estándar de terminal: verde éxito, rojo error, amarillo warn.
    let outMsg = msg;
    if (channel === "ok") outMsg = color.ok(msg);
    else if (channel === "error") outMsg = color.error(msg);
    else if (channel === "warn") outMsg = color.warn(msg);
    else if (channel === "info") outMsg = color.dim(msg);
    out.write(p ? `${p} ${outMsg}\n` : `${outMsg}\n`);
  };

  const base: Logger = {
    info: (m) => emit("info", m),
    ok: (m) => emit("ok", m),
    error: (m) => emit("error", m),
    warn: (m) => emit("warn", m),
    raw: (m) => emit("raw", m),
    child: (prefix) => {
      const c: Logger = {
        info: (m) => emit("info", `${prefix} ${m}`),
        ok: (m) => emit("ok", `${prefix} ${m}`),
        error: (m) => emit("error", `${prefix} ${m}`),
        warn: (m) => emit("warn", `${prefix} ${m}`),
        raw: (m) => emit("raw", m),
        child: base.child,
      };
      return c;
    },
  };

  return base;
}

export const log: Logger = createLogger();
