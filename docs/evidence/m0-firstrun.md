# M0.f — Primer arranque + problemas observados (2026-09-21)

## Primer arranque sin claves + "hola" (pty, HOME virgen, VERIFICADO EJECUTANDO)
- Arranca en INGLÉS (sin `prefs.json` no hay autodetección del SO).
- Sin aviso de plan gratuito en pantalla (`freeWarningOnce` va al log del
  motor, invisible en la Go). El usuario no sabe que funciona sin claves.
- "hola" aceptado en 511 ms pero sin respuesta en 60 s+ (`thinking…
  ((router))` + `turn running` eternos): el stall del router auto (M0.a)
  golpea de lleno al primer uso. Peor primera impresión posible.
- Repintado pesado de la caja de entrada en cada frame (ruido en la captura;
  posible coste de CPU → M4 lo medirá).

## Problemas ya observados por el usuario
1. **"asistente de IA de nivel bajo"** — causa en `src/core/identity.ts:49-51`:
   el prompt ORDENA decir `"Noira · <nivel>"`; el modelo lo verbaliza
   ("nivel bajo") y se filtra el ajuste interno (SOLO POR CÓDIGO + reporte
   usuario; arreglo en M1.6 con test anti-fuga en 7 idiomas).
2. **`modelo: (router)`** — VERIFICADO en capturas (`vacia.txt`, firstrun) y
   en el evento `hello` (`modelo":"(router)"`). Solo cambia al modelo real
   tras rotar (visto en `conversacion.txt`: `nvidia/nemotron…`).
3. **`conectado al motor`** — VERIFICADO en capturas; jerga interna
   (M3.3: cambiar por "listo").
4. **Título = primer mensaje** — VERIFICADO (`sesión: Responde solo con la
   palabra OK`); M2.8 lo sustituye por títulos inteligentes.

## Hallazgo extra (memoria ejecuta instrucciones)
Un turno de prueba de esta sesión creó `hola_noira.txt` ("Hola Noira E2E")
en la raíz: el motor leyó `AGENTS.md` (memoria de proyecto con tareas
imperativas de septiembre) y ejecutó una. Fichero eliminado, `AGENTS.md`
intacto. Pasa a M2.8e/M5.3 (contenido de memoria = datos, nunca
instrucciones; el generador de títulos y el loop deben tratarlo así).
