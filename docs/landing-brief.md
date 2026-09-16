# NoiraCoder — Landing Brief (interno, no desplegar aún)

> Este archivo es el **brief para la futura landing**. No es la landing. Guarda visión, pricing, diferenciadores y roadmap para cuando decidas publicar.

## Posicionamiento

**NoiraCoder — tu senior 24/7, gratis.**

La mejor experiencia de coding agentic del mundo, con modelos gratuitos y cuota casi ilimitada. Calidad GPT-6 + Claude 5 sin pagar 20€/mes. Cuando lo pruebas, no vuelves.

Eslogan alternativos:
- El coder que nunca falla.
- Código premium sin pagar.
- Nº1 en todos los ámbitos — velocidad, calidad, belleza, confianza.

## Propuesta de valor (por qué es #1)

1. **Cuota casi ilimitada gratis** — 50+ modelos free rotando inteligente (OpenRouter + Zen + Groq + HF + todos los que existan). Un solo clic, nosotros gestionamos tus cuentas. 24h seguidas sin notar límites.
2. **Memoria que aprende** — recuerda tu estilo, tu proyecto, tus decisiones. Cada día mejora contigo. AGENTS.md auto-evolutivo + notas con tags + sesión persistente.
3. **TUI que enamora** — negro #000 + amarillo #f9e2af + magenta #D63384, flujo OpenCode (thinking, tools colapsables, streaming), sesiones con búsqueda, diff inline. Sobrio como Claude, con identidad Noira.
4. **Orquestación dinámica real** — equipo de sub-agentes (research → code → review → security) que se crean según la tarea, en paralelo donde se pueda. Plan con marcadores + resumen final.
5. **Calidad sin concesiones** — todos los lenguajes perfectos vía skills por lenguaje, auto-fix hasta tests verdes, review interno, docs auto.

## Público

Todos: vibe coders principiantes hasta seniors, ciberseguridad, equipos pequeños. Se auto-adapta a cada usuario (tono + detalle + flujo) aprendiendo de uso.

## Pricing (validado en 100 preguntas)

- **Prueba gratuita 1 mes** (sin tarjeta, tras testeo interno tuyo).
- Luego **0,99 €/mes** — suscripción simple, sin tiers.
- BYOK opcional si el usuario quiere modelos de pago (su key, nuestro routing).

> No hay comparativas agresivas en la landing. La calidad convence sola al usarlo.

## Instalación (objetivo)

```bash
curl -fsSL https://noiracoder.noira.sh/install | sh
# o
npm i -g noiracoder
noira "tu tarea"
noira --help
noira login   # un clic OAuth
```

Comando: `noira` (marca). `nc`/`noiracoder` como alias.

## Flujo ideal (resumen 100 preguntas)

1. `noira` → lee AGENTS.md + estructura del repo (bienvenida sutil).
2. Pides tarea → Noira planifica (plan colapsable con marcadores), codifica, testea, auto-fix hasta verde, review interno, te muestra diff + resumen.
3. Crítico (deploy, rm, push) → pide aprobar/rechazar/otra opción estilo OpenCode.
4. Sesiones persistentes con búsqueda y nombres inteligentes (modelo resume).
5. offline solo si lo eliges o sin internet — aviso bonito Pro con acciones.

## Skills (pack 10, ver `skills/`)

1. `code-review` — revisa diffs, detecta bugs, sugiere mejoras
2. `testing` — escribe/ejecuta tests, coverage
3. `refactor` — clean code, patrones, deuda técnica
4. `debug` — reproduce, aísla, corrige con pruebas
5. `planning` — descompone tareas grandes en pasos
6. `docs` — README, AGENTS.md, JSDoc auto
7. `git-flow` — commit messages, branch, PR
8. `security` — escanea secretos, inyecciones, permisos
9. `perf` — perfiles, optimiza hot paths
10. `lang-expert` — per-lenguaje (TS/Python/Go/Rust...) — se activa según stack detectado

## Roadmap (interno)

- [x] Harness TS + OpenRouter + adaptive routing + sandbox + memoria jerárquica
- [ ] Pool 50+ free + validación real + refresh 1h + rotación ilimitada multi-provider
- [ ] Orquestación dinámica real (hoy solo orquestador)
- [ ] TUI OpenCode flow + streaming + sesiones + paleta NoiraX (amarillo/magenta)
- [ ] 10 skills killer + marketplace curado
- [ ] Instalador 1 comando + auto-update silencioso
- [ ] Tests alta cobertura + dogfooding
- [ ] Landing + manual + docs premium

## Identidad verbal

- Cálida pro: `> listo — 3 archivos. Tests verdes, dale.`
- Prefijos: `>` `[ok]` `[error]` `[warn]` + ✓/✗/→ sutil, sin emojis invasivos
- Idioma: detecta script + memoria, 62 idiomas (con Latin classifier pendiente)

## Notas para landing futura

- Diseño: clonar orden NoiraX (negro #000 + amarillo #f9e2af + magenta #D63384 + JetBrains Mono + Inter), sin verde, sobrio premium.
- Navegación: como OpenCode (flujos, chat, tools), no como NoiraX trading.
- Prueba social: tras testeo real tuyo (días de uso), añadir track-record / demo GIF.
- Legal: no auto-registro de cuentas, OAuth explícito por usuario (ToS safe).

---
*Creado tras 100 preguntas. No desplegar hasta que el producto pase tu testeo de días.*
