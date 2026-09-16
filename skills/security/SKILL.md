---
name: security
description: Escanea secretos, inyecciones y permisos. Úsala antes de tocar infra, auth o datos sensibles.
---

# Security — Noira

Obligatoria antes de cambios en: auth, infra, DB, secretos, pagos.

1. Busca: hardcodes (`apiKey`, `password`, `.env`), inyección (SQL, XSS, command), permisos abiertos.
2. Si detectas riesgo, bloquea y pide confirmación: `> [warn] posible secreto en src/config.ts:12 — ¿continuar?`
3. Sugiere fix: env vars, sanitización, allowlist.
4. Nunca reveles secretos en logs o diffs.

Si no hay riesgo: `> [ok] security: 0 hallazgos.`
