# NOIRACODER-PROGRESS.md — estado del programa v2 (cliente fino)

## Arquitectura decidida
Pantalla Go = CLIENTE FINO (pinta + teclas). Motor TS (`noira serve`) = único
cerebro (modelos, tools, sandbox, memoria, sesiones, rotación, cuotas).
Protocolo: `docs/PROTOCOL.md` v1. Amenazas: `docs/THREAT-MODEL.md`.
Proveedores por defecto: Kilo + OpenRouter (sin claves); Groq/Zen opcionales.
Sin app de escritorio ni extensión IDE. Sin "privacidad local" en el mensaje.

## Hito 0 — SEGURIDAD INMEDIATA Y DISEÑO
- [x] 0.1a Wrapper: Node por defecto; Go solo `--go` + aviso; `nc` nunca Go
      (`bin/noiracoder.mjs`). Verificado: `--version` → Node; `--go` sin TTY →
      aviso + Node; lógica isNc probada con basenames.
- [x] 0.1b Release v0.1.0 → pre-release, assets Go eliminados; install.sh/ps1
      ya no descargan binario Go.
- [x] 0.1c Sandbox: las afirmaciones viven en el motor TS (policies/approve) y
      landing describe el motor; nada atribuye sandbox a la Go.
- [x] 0.2 `docs/PROTOCOL.md` v1 escrito.
- [x] 0.3 `docs/THREAT-MODEL.md` escrito (T1–T5 + no-cubierto).
- [x] 0.4 Decisión: confirmar = DENEGAR por defecto; prohibidos denegados
      SIEMPRE (en PROTOCOL.md §5).
- Puerta 0 APROBADA (v3, modo autónomo 2026-09-19). Sigue Hito 1.

## Hito 1 — ESQUELETO ANDANTE (COMPLETO 2026-09-19, commits f516610, 266f9ec, 2d98aeb)
- [x] Hooks motor: `signal`, `onModelSwitch`, `model?` (E2E 48/48 sin cambio).
- [x] Servidor thin SSE + `serve --thin` (evidencia docs/evidence/h1-thin-server.md).
- [x] Go cliente fino (rama noira-rebrand 7776194): `internal/thinclient` +
      `cmd/noira-thin`; `go list -deps` sin rastro de llm/permission/session/db/config.
- [x] Wrapper ciclo de vida: puerto libre, token 32B por env, /health, matar
      motor al salir, parent-watchdog anti-huérfanos, fallback Ink.
- [x] Pruebas pty 9/9 (docs/evidence/h1-pty.md): boot, streaming, fin de turno,
      matar motor → error visible, matar pty → sin huérfanos, 409, 401/426 por HTTP.
- Siguiente: HITO 2 (confirmaciones/tools, memoria visible, saneo+adversaria).

## Hito 2 — FUNCIONALIDAD + ADVERSARIA (en curso, 2026-09-19)
- [x] 2.1 Herramientas vía motor: `onTool` en registry→orchestrator→thin
      (`turn.tool_start/end`), deploy ya exigía confirm, plan mode deniega todo.
      Watchdog con margen de herramienta (10 min). Evidencia docs/evidence/h2-tools.md.
- [x] 2.2 Memoria/rotación/cuotas visibles: `onMemoryEvent` (proyecto+global),
      `onQuota` en router + `quotaState`, `model.switch` ya fluía. Verificado en
      vivo: `model.quota usadoPct 6→8`, `memory.event` proyecto+global, `turn.end done`.
      E2E 48/48 tras los cambios.
- [x] 2.3 Sesiones UI: `GET /v1/sessions/:id` + comandos Go (/sessions con filtro,
      /resume n|id con historial, /new, /plan, /build, /model, /help, /quit).
      Verificado pty 6/6 (9 sesiones persistidas listadas, reanudación con turnos).
- [ ] 2.2 Memoria/rotación/cuotas visibles en la Go.
- [ ] 2.3 Sesiones UI (listar/buscar/reanudar, Plan/Build, historial).
- [x] 2.4 Saneo + corpus: `src/server/sanitize.ts` + `test/sanitize.mjs`
      (10/10, `npm run test:sanitize`) y Go byte-oriented + `sanitize_test.go`
      (12/12). Cubre ANSI/OSC/APC/C1/C0/DEL/bidi-spoof/truncado. Hallazgo: los
      bytes C1 sueltos no son UTF-8 válido (U+FFFD) — por eso el saneo Go es
      a nivel de byte.
- [x] 2.5 Adversaria: `test/adversarial.mjs` 36/36 (`test:adversarial`) + E2E
      48/48. Turnos reales: canario intacto, trap de injection leída pero no
      ejecutada, fichero 10MB rechazado con guía. Evidencia
      docs/evidence/h2-adversarial.md. Campo de pruebas limpiado.
- [x] 2.6 Residual env-token documentado en THREAT-MODEL.md.
- HITO 2 COMPLETO. Siguiente: HITO 3 (experiencia).

## Hito 3 — EXPERIENCIA (COMPLETO 2026-09-19)
- [x] 3.1 Diff OpenCode vs thin (docs/evidence/h3-diff.md + frame legacy por pty).
      Decisión: comandos texto en vez de pickers; no se clona init/dialogs.
- [x] 3.2/3.3 Pantalla completa + responsive (entrada compacta si <18 filas) +
      hints + sin marca antigua en el cliente (docs/evidence/h3-pty pendiente).
- [x] 3.4 TTFB medido en vivo: 3729 ms (POST→primer delta, modelo real).
      Pensando con nombre, rotación visible, watchdog 60s/10min, Ctrl+C cancela.
- [x] 3.5 Historial ↑↓ (pty 5/5), /help con atajos, /model, /quit.
- [x] 3.6 UI en 7 idiomas (lang.go + lang_test.go: tabla completa, sin
      idénticas al inglés salvo cognados, detectLang por prefs.json).
      Verificado pty en EN y AR (placeholder/hints/help, sin mojibake).
      Pendiente (servidor): cadenas de error/detalle del motor en español.
- [x] 3.7 docs/PRUEBA-VISUAL.md (6 checks) → PENDIENTE DEL USUARIO.
- Siguiente: HITO 4 (Kilo + OpenRouter).

## Hito 4 — PROVEEDORES (COMPLETO 2026-09-19)
- [x] 4.1 Kilo verificado (docs + anónimo 200 + 20 :free/18 con tools).
- [x] 4.2 Router (KiloClient, classify, isNetworkError, dead-tras-3).
- [x] 4.3 Cuotas (OR existente + Kilo doc + avisos vivos).
- [x] 4.4 Sin claves (env limpio: kilo-20 + turno done) + connect reescrito.
- [x] 4.5 Kilo caído → aviso + failover (antes: error sin rotar).
- [x] 4.6 OpenRouter muerta → warn + flip + sigue (en vivo).
- [x] 4.7 freeWarning 7 idiomas, una vez (run + thin).
- Fixes: caché (v5, por-hogar, nunca vacío), tags provider, modelo "" .
- E2E 48/48 + adversarial 36/36 + sanitize tras todo.
- Siguiente: HITO 5 (mensaje, traducciones, landing, blog).

## Hito 5 — MENSAJE + TRADUCCIONES + LANDING + BLOG (en curso, 2026-09-19)
- [x] 5.1 Sin "privacidad local": mensaje nuevo (memoria+rotación+sin registro)
      en i18n.js ×7, metas, sobre, que-es. CLI ya limpio. Quedan: claves
      cifradas + servidor con token (permitido).
- [x] 5.2 Frase por frase: causa raíz del EN-en-ES (clave `cmds` duplicada en
      NOIRA_ES → fallback EN), AR (basura + chino + dup), IT day-by-day.
      Pres traducidos (index 3, tuto 11, skills 1). Skills cards reutilizan
      teasers (+4 nuevas ×7).
- [x] 5.3 `npm run test:i18n` en verde (paridad 162, sin-traducción, dups,
      texto-sin-clave, resolución ×7, pres con clave).
- [x] 5.4 Tutoriales reescritos (Kilo primero, pantalla Go) + barrido estándar.
- [x] 5.6 Blog en 7 idiomas (7 llamadas con pausa + render con fallback):
      verificado en vivo 7/7 con títulos y cuerpos propios.
- [x] 5.7 Deploy CI (35474773266) + verificación en producción: 10 claves ×
      7 idiomas idénticas local==prod (h5prod, runtime-vs-runtime).
- HITO 5 COMPLETO. Siguiente: HITO 6 (distribución).

## Hito 6 — DISTRIBUCIÓN (COMPLETO en Windows 2026-09-19, sin publicar por 0.6)
- [x] 6.1 CI release.yml (5 targets + NOTICE + SHA256SUMS; tags noira-go-v*).
      Dispatch 35475389513 OK; 5 binarios verificados (cabeceras+boot Win).
- [x] 6.2 fetch-go-binary (hash + override + fallback) en `files`+postinstall.
- [x] 6.3 install.sh/ps1 con fetch explícito (approve global no existe).
- [x] 6.4 Windows aislado 3/3 (boot, Kilo sin claves, sessions, uninstall).
      macOS/Linux: SOLO POR CÓDIGO + artefactos CI.
- QuotaTracker ahora respeta NOIRARC_HOME (antes, homedir fijo).
- Siguiente: HITO 7 (verificación final; publicar SOLO si todo pasa).

## Hito 7 — VERIFICACIÓN FINAL (listo para publicar, 2026-09-20)

## Verificaciones pedidas (2026-09-20, sin publicar)
- [x] CI multi-OS (`verify-thin.yml`, run 35506528146): ubuntu + macos-14
      (arm64) + macos-15-intel (x64) en verde — build, boot exit 2, wrapper,
      install.sh en ubuntu. Evidencia docs/evidence/ci-thin.md.
- [x] Fallback Ink ante Go rota (pty local 4/4 + rama 10 s con notepad):
      falta/crash/exit<3s/spawn-error → Ink con mensaje; colgada → kill+Ink.
      Endpoint `GET /v1/status` para el watchdog.
- Lección: `name:` YAML con `:` sin entrecomillar tumba el workflow (runs 0s
  + dispatch 422). Validador local con go+yaml.v3.
- [x] 7.1 Suites en verde (ver arriba) + Go tests + vet.
- [x] 7.2 pty 9/9 con binario CI (docs/evidence/h7-final.md).
- [ ] 7.3 Publicar (runbook):
      1. `npm version minor` (0.1.0 → 0.2.0) + push.
      2. `git tag noira-go-v0.2.0` + push → CI adjunta 5 binarios + SHA256SUMS.
      3. Usuario: `npm publish --access public` (pide su security key) + output.
      4. Yo: install limpio global en temp (verifica hash+boot) y constancia.
- Para retomar: este archivo desde "Hito 0"; evidencia en docs/evidence/.
- [x] 6.2 fetch-go-binary (hash + override + fallback) en `files`+postinstall.
- [x] 6.3 install.sh/ps1 con fetch explícito (approve global no existe).
- [x] 6.4 Windows aislado 3/3 (boot, Kilo sin claves, sessions, uninstall).
      macOS/Linux: SOLO POR CÓDIGO + artefactos CI.
- QuotaTracker ahora respeta NOIRARC_HOME (antes, homedir fijo).
- Siguiente: HITO 7 (verificación final; publicar SOLO si todo pasa).

## PENDIENTES DEL USUARIO
- Regenerar clave OpenRouter (`noira login`) — la actual da 401.
- PRUEBA-VISUAL.md (Hito 3.7) en su terminal real.
- Crear formulario Formspree de NoiraCoder (Hito 5.5).
- [ ] 2.5 Batería adversaria T1–T5 + 48 E2E.
- [ ] 2.6 Riesgo residual env-token.

## Pendientes (no bloquean Hito 1)
- `README.md:16` apunta a `https://noiracoder.noira.sh/install` (dominio externo,
  fuera del repo): revisar en Hito 5.
- Rama TTY real de `--go` (lanza binario con aviso): SOLO POR CÓDIGO, el
  usuario la prueba visualmente (no hay pty en este entorno).
- Licencia MIT + copyright Kujtim Hoxha 2025 conservados; falta NOTICE en
  binarios (Hito 6).

## Evidencia Fase 0 previa (v1, ya verificada)
- Sonda Go: echo/&& ejecutan tras "sí"; del/format atraviesan la tool
  (exit 127 en bash); curl baneado. Fichero sonda borrado, árbol limpio.
- Wrapper antiguo pasaba claves por JSON.parse de keys.json cifrado (roto
  silencioso) — eliminado en el wrapper nuevo (la Go no verá claves).
