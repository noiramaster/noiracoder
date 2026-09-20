# Evidencia — verificación multi-OS en runners (2026-09-20, run 35506528146)

Workflow `.github/workflows/verify-thin.yml` (dispatch manual): 3/3 verde.
- `verify (ubuntu-latest)` 1m04s — Linux x86_64, go1.26.8.
- `verify (macos-14)` 53s — Darwin arm64 (Apple Silicon), go1.26.7.
- `verify (macos-15-intel)` 3m30s — Darwin x86_64 (Intel).

Por job, verificado en logs:
- `go build ./cmd/noira-thin` OK (p. ej. ubuntu: 7880969 bytes).
- Boot sin entorno: `exit=2` + `[noira-thin] faltan NOIRA_PORT/NOIRA_TOKEN…`.
- Wrapper: `node bin/noiracoder.mjs --version` → `NoiraCoder 0.1.0`;
  `--go --version` (sin TTY) → mismo + aviso de fallback.
- Solo ubuntu: `install.sh` de punta a punta (`sudo bash install.sh`):
  `> Noira — instalando...`, `added 133 packages`, `[ok] instalado…`.

Lección de infraestructura (honesta): dos rechazos 422/dispatch y runs 0s
fueron un error de sintaxis YAML (`:` en escalar plano `name: …esperado: …`),
NO la matriz ni las etiquetas. Se añadió validador local (go+yaml.v3) y se
documenta: entrecomillar siempre `name:` con dos puntos.
