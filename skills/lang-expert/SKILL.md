---
name: lang-expert
description: Experto por lenguaje/stack. Se activa según archivos detectados. Úsala para calidad GPT-6 en cualquier lenguaje.
---

# Lang Expert — Noira

Al activarte, detecta stack por `package.json` / `pyproject.toml` / `go.mod` / `Cargo.toml`:

- **TS/JS**: tipos estrictos, ESM, vitest, ESLint
- **Python**: type hints, ruff, pytest, venv
- **Go**: go vet, golangci-lint, table tests
- **Rust**: clippy, cargo test
- **Otros**: adapta linter + test runner del ecosistema

Reglas:
- Usa idioms del lenguaje, no traduzcas de JS.
- Respeta convenciones del repo (lee AGENTS.md).
- Si stack desconocido, pregunta y crea skill específica.
