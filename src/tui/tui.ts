/**
 * Noira TUI — minimal Claude/OpenCode style.
 * Sin cajas pesadas. Solo texto + 1 input abajo + status sutil.
 * Paleta: amarillo para > y highlights, magenta para noira, gray para muted.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { render, Box, Text, useInput, useApp } from "ink";
import { orchestrate } from "../agents/orchestrator.js";
import { resolveApiKey, storeKey } from "../auth/keys.js";
import { interactiveSignIn } from "../auth/oauth.js";
import { connectMcp } from "../mcp/connect.js";
import type { McpRegistry } from "../mcp/registry.js";
import type { Level } from "../types.js";
import type { AgentRole } from "../agents/roster.js";

const C = { yellow: "#FBBF24" as const, green: "green" as const, red: "red" as const, magenta: "magenta" as const, dim: "gray" as const, white: "white" as const };

interface Msg { role: "user" | "assistant"; content: string; }

const GOLD = "#FBBF24";

export async function runTui(opts: { cwd: string; version: string }): Promise<number> {
  const mcp = await connectMcp(opts.cwd);
  return new Promise((resolve) => {
    const { waitUntilExit } = render(React.createElement(App, { cwd: opts.cwd, version: opts.version, mcp }), { exitOnCtrlC: true });
    waitUntilExit().then(() => { mcp?.close(); resolve(0); });
  });
}

function App({ cwd, version, mcp }: { cwd: string; version: string; mcp?: McpRegistry | null }) {
  const { exit } = useApp();
  const [key, setKey] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [level] = useState<Level>("medium");
  const [agent, setAgent] = useState<AgentRole | null>(null);
  const [stream, setStream] = useState("");
  const [auth, setAuth] = useState<"checking" | "ready" | "need">("checking");
  const [pendingConfirm, setPendingConfirm] = useState<string | null>(null);
  const confirmResolveRef = useRef<((ok: boolean) => void) | null>(null);
  const inputRef = useRef("");

  useEffect(() => {
    resolveApiKey({ allowInteractive: false }).then((k) => {
      if (k) { setKey(k); setAuth("ready"); }
      else setAuth("need");
    }).catch(() => setAuth("need"));
  }, []);

  /**
   * Security: real confirmation in the TUI. When a dangerous action requests
   * confirmation, we show a prompt and capture an explicit y/N from the user
   * via a dedicated state; we never auto-accept (the old `() => true` bypass).
   */
  const requestConfirm = useCallback((msg: string): Promise<boolean> => {
    setPendingConfirm(msg);
    return new Promise<boolean>((resolvePrompt) => {
      confirmResolveRef.current = (ok) => {
        confirmResolveRef.current = null;
        setPendingConfirm(null);
        resolvePrompt(ok);
      };
    });
  }, []);

  const doAuth = useCallback(async () => {
    setAuth("checking");
    try {
      const res = await interactiveSignIn();
      await storeKey("openrouter", res.key);
      setKey(res.key);
      setAuth("ready");
    } catch (e) {
      setMsgs((p) => [...p, { role: "assistant", content: `[error] No se pudo autorizar: ${e instanceof Error ? e.message : String(e)}\n> Prueba: noira login` }]);
      setAuth("need");
    }
  }, []);

  const send = useCallback(async (text: string) => {
    if (!text || loading) return;
    setMsgs((p) => [...p, { role: "user", content: text }]);
    setLoading(true); setStream(""); setAgent("orchestrator");
    if (!key) { setMsgs((p) => [...p, { role: "assistant", content: "Sin conexión. Escribe /login" }]); setLoading(false); return; }
    try {
      const r = await orchestrate(text, {
        level, cwd,
        log: { raw: () => {}, info: () => {}, ok: () => {}, warn: () => {}, error: () => {} } as any,
        confirm: requestConfirm, freeOnly: true, apiKey: key, allowInteractiveAuth: false,
        mcp: mcp ?? undefined,
        onToken: (d) => setStream((s) => s + d),
        onAgentStart: (role) => { setAgent(role); setStream(""); },
      });
      setMsgs((p) => [...p, { role: "assistant", content: r.output }]);
    } catch (e) {
      setMsgs((p) => [...p, { role: "assistant", content: `[error] ${e instanceof Error ? e.message : String(e)}` }]);
    } finally { setLoading(false); setAgent(null); setStream(""); }
  }, [loading, level, cwd, key, requestConfirm, mcp]);

  useInput((ch, k) => {
    // When a confirmation is pending, only y/Y/yes or n/N/no are meaningful.
    if (pendingConfirm) {
      const t = inputRef.current.trim().toLowerCase() || (ch ?? "").toLowerCase();
      if (t === "y" || t === "yes" || ch === "y" || ch === "n") {
        const ok = (ch === "y" || t === "y" || t === "yes") && (ch !== "n");
        confirmResolveRef.current?.(ok);
        inputRef.current = ""; setInput("");
      } else if (t === "n" || t === "no") {
        confirmResolveRef.current?.(false);
        inputRef.current = ""; setInput("");
      }
      return;
    }
    if (k.ctrl && ch === "c") { exit(); return; }
    if (k.return) {
      const t = inputRef.current.trim();
      if (t === "/login") { inputRef.current = ""; setInput(""); doAuth(); return; }
      if (t === "/clear") { setMsgs([]); inputRef.current = ""; setInput(""); return; }
      if (t === "/help") { setMsgs((p) => [...p, { role: "assistant", content: "Comandos: /login  /clear  /help\nAtajos: ctrl+c salir" }]); inputRef.current = ""; setInput(""); return; }
      inputRef.current = ""; setInput("");
      if (t) send(t);
      return;
    }
    if (k.backspace) { inputRef.current = inputRef.current.slice(0, -1); setInput(inputRef.current); return; }
    if (!k.ctrl && !k.meta && ch) { inputRef.current += ch; setInput(inputRef.current); }
  });

  if (auth === "checking") {
    return React.createElement(Box, { flexDirection: "column", padding: 1 },
      React.createElement(Box, { flexDirection: "column" },
        React.createElement(Text, { color: C.yellow, bold: true }, "> noira"),
        React.createElement(Text, { color: C.yellow }, "> >> >"),
      ),
      React.createElement(Text, { color: C.dim }, " cargando..."),
    );
  }

  if (auth === "need") {
    return React.createElement(Box, { flexDirection: "column", padding: 1, gap: 1 },
      React.createElement(Box, { flexDirection: "column" },
        React.createElement(Text, { color: C.yellow, bold: true }, `> noira ${version}`),
        React.createElement(Text, { color: C.yellow }, "> >> >  >"),
      ),
      React.createElement(Text, null, "Bienvenido a NoiraCoder — tu senior 24/7, gratis."),
      React.createElement(Text, { color: C.dim }, "Necesitas autorizar una vez (un clic)."),
      React.createElement(Box, { flexDirection: "column", marginTop: 1 },
        React.createElement(Text, { color: C.yellow }, "  > Presiona Enter para autorizar con OpenRouter"),
        React.createElement(Text, { color: C.dim }, "    (se abre el navegador, 1 clic y listo)"),
        React.createElement(Text, { color: C.dim }, "  > O escribe /login"),
      ),
      React.createElement(Box, { marginTop: 1, flexDirection: "column" },
        React.createElement(Text, null, input ? `> ${input}` : "> "),
      ),
    );
  }

  // Chat — minimal, sin cajas
  const list = msgs.length === 0
    ? [React.createElement(Box, { key: "e", flexDirection: "column", paddingY: 1 },
        React.createElement(Text, { color: C.yellow, bold: true }, "> >> >  >"),
        React.createElement(Text, { color: C.yellow }, "> >    >"),
        React.createElement(Text, { color: C.yellow }, "> >> >  >"),
        React.createElement(Text, { color: C.dim }, `Noira · ${level} · escribe tu tarea y presiona Enter`),
        React.createElement(Text, { color: C.dim }, "/help para comandos"),
      )]
    : msgs.map((m, i) => React.createElement(Box, { key: i, flexDirection: "column", paddingY: 1 },
        React.createElement(Text, { color: m.role === "user" ? C.yellow : C.magenta, bold: true }, m.role === "user" ? "> tú" : "◆ noira"),
        React.createElement(Text, { wrap: "wrap" }, m.content),
      ));

  const thinking = loading
    ? React.createElement(Box, { flexDirection: "column", paddingY: 1 },
        React.createElement(Text, { color: C.yellow }, agent ? `◐ ${agent}...` : "◐ pensando..."),
        stream ? React.createElement(Text, { color: C.dim, wrap: "wrap" }, stream.slice(0, 800)) : null,
      )
    : null;

  const confirmPrompt = pendingConfirm
    ? React.createElement(Box, { flexDirection: "column", marginTop: 1, padding: 1 },
        React.createElement(Text, { color: C.yellow, bold: true }, "CONFIRMACIÓN REQUERIDA"),
        React.createElement(Text, { wrap: "wrap" }, pendingConfirm),
        React.createElement(Text, { color: C.yellow }, "> [y] sí   [n] no (escribe y o n y presiona Enter)"),
      )
    : null;

  return React.createElement(Box, { flexDirection: "column", paddingX: 1, paddingY: 1 },
    React.createElement(Box, { flexDirection: "row", justifyContent: "space-between" },
      React.createElement(Text, { color: C.yellow, bold: true }, `> noira ${version}`),
      React.createElement(Text, { color: C.dim }, `Noira · ${level}`),
    ),
    React.createElement(Box, { flexDirection: "column", flexGrow: 1, marginTop: 1 },
      ...list,
      thinking,
    ),
    pendingConfirm
      ? confirmPrompt
      : React.createElement(Box, { marginTop: 1 },
          React.createElement(Text, { color: C.yellow }, "> "),
          React.createElement(Text, null, input),
          React.createElement(Text, { color: C.dim }, loading ? "" : "█"),
        ),
    React.createElement(Text, { color: C.dim }, " /help · /login · ctrl+c salir"),
  );
}
