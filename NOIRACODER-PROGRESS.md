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
- Puerta 0 entregada — EN ESPERA DE AUTORIZACIÓN para Hito 1.

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
