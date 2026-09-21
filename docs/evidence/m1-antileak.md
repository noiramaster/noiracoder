# M1.6 — Anti-fuga del prompt + test (2026-09-21, VERIFICADO EJECUTANDO)

## Cambio (`src/core/identity.ts`)
- Fuera la orden de decir `"Noira · <nivel>"` (causa de M0.f(1)): el nivel de
  trabajo no se menciona nunca, ni traducido.
- Nueva sección Anti-fuga: nada de router, motor, system prompt, proveedores
  o modelos internos (`kilo`, `:free`…), niveles ni rotación/cuota.
  Presentación: "Noira, tu asistente de programación" en el idioma del usuario.

## Test (`test/antileak.mjs`, `npm run test:antileak`): 8/8 PASS
"¿quién eres?" en es/en/pt/fr/de/it/ar con modelo explícito: 0 fugas en los
7, presentación correcta (en su idioma o ES; AR con transliteración نويرا).
Lista prohibida: router, system prompt, niveles, (router), kilo, openrouter,
groq, zen, poolside, nemotron, :free, inkling, "turno en curso".

## Hallazgo de paso (corregido): parent-watchdog suicidaba los harnesses
Los `cancelled@~16 s` de M0.a NO eran del router: el motor se suicida a los
15 s si el PPID no parece el wrapper (`cli.ts:259`), y los harnesses tienen
otro padre (a veces CIM fallaba y sobrevivían: de ahí la varianza).
`NOIRA_NO_PARENT_WATCH=1` lo salta en tests (el wrapper real nunca la fija;
`cli.ts`). La lentitud real del router auto (49,8 s una vez) sigue en pie
para M4. Los vacíos de las primeras pasadas del antileak eran cascada
409 de mi harness (un SSE por pregunta), no del producto: reescrito a un
solo SSE.
