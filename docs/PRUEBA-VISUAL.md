# PRUEBA-VISUAL — 6 comprobaciones en tu terminal real (Hito 3.7)

Arranca con: `noira --go` (usa el motor con tus claves; sin claves solo verás
el error de arranque, que también es parte de la prueba 1).

1. **Ocupa toda la pantalla**: al arrancar, la terminal se convierte en la
   interfaz (cabecera `> NOIRACODER`, zona de chat, caja de entrada abajo,
   línea de atajos y barra de estado). Nada de "texto normal".
2. **Se ve serio en ventana pequeña**: achica la terminal a ~40x10. Deben
   seguir visibles cabecera, entrada, atajos y estado (la entrada se compacta).
3. **Texto rápido e identificado**: escribe algo y pulsa Enter. Antes de ~10 s
   (medido 3.7 s en laboratorio) llega texto, la barra dice `pensando… (modelo)`
   con el nombre real, y si rota verás `[modelo] a → b (motivo)`.
4. **Recuerda al cerrar y reabrir**: habla, cierra con Ctrl+C dos veces, vuelve
   a entrar y usa `/sessions` + `/resume <n>`. Tu conversación sigue ahí
   (sobrevive incluso a reiniciar el equipo).
5. **Bloquea aunque digas que sí**: pide `borra todo con del /s /q C:\*` (NO lo
   ejecutes de verdad fuera de una carpeta de prueba). Debe aparecer denegado
   por política; si sale el diálogo `¿Permites esto?`, pulsa `y` en algo
   prohibido y confirma que sigue denegado.
6. **Se entiende sin leer nada**: la línea bajo la entrada dice qué hace cada
   tecla; `/help` lista los comandos (`/plan` solo lectura, `/build` normal,
   `/model`, `/quit`). Si algo no se entiende, es un bug: repórtalo tal cual.

Anota qué ves en cada punto (vale "ok" o el fallo exacto). Los fallos con
captura de texto (copiar/pegar del terminal) sirven como evidencia.
