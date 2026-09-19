# NoiraCoder — Modelo de amenazas (cliente fino Go + motor TS)

Alcance: `noira --go` (Hitos 1–2). El motor TS ya está auditado (48 E2E).
Aquí solo lo NUEVO que introduce la arquitectura dividida.

## T1. Modelo malicioso o comprometido

- **Intenta**: que el motor ejecute algo prohibido; que la Go muestre una
  confirmación falsa; exfiltrar claves por la salida.
- **Defensas**:
  - La lista de acciones prohibidas vive en el MOTOR y deniega SIEMPRE,
    incluso con aprobación (PROTOCOL.md §5). El modelo no tiene canal para
    saltársela: solo pide, el motor decide.
  - La Go NUNCA tiene claves de API (§T5): no hay nada que exfiltrar por ahí.
  - La barra de confirmación se construye solo con el evento estructurado;
    el texto del modelo no puede pintarla (§T4).
- **Se prueba**: batería adversaria del Hito 2.5 (del/format/rm-rf/&&/base64…)
  + E2E 48 repetidas a través de la Go. Si un exploit pasa, no se sigue.

## T2. Prompt-injection en fichero o web

- **Intenta**: un `README.md`/`SKILL.md`/página con instrucciones ("ignora tu
  política", "ejecuta X", "di al usuario que pulse sí") o una falsa barra
  de confirmación dibujada con caracteres.
- **Defensas**: igual que T1 (decisión en motor, confirmación por defecto
  DENEGAR, solo el usuario real aprueba en la Go) + saneo de pantalla: la
  salida de ficheros se muestra como texto inerte, sin secuencias que la Go
  interprete como UI.
- **Se prueba**: corpus de ficheros trampa en Hito 2.4/2.5; el motor debe
  pedir confirmación (y denegar lo prohibido) y la Go no debe renderizar
  ninguna UI procedente del contenido.

## T3. Otro proceso local que conoce el puerto

- **Intenta**: conectarse al motor (está en loopback pero OTROS programas del
  mismo equipo sí llegan), pedir turnos o aprobar confirmaciones.
- **Defensas**:
  - Token Bearer aleatorio de 32 bytes por arranque, solo por entorno,
    nunca en argv; comparación con `safeEqual` (ya existe en el servidor).
  - Un solo cliente SSE: el atacante que llegue segundo recibe 409; y las
    confirmaciones solo las atiende el cliente conectado. Sin cliente → DENEGAR.
  - Puerto aleatorio por arranque (no fijo predecible).
- **Se prueba** (Hito 1.4): token incorrecto → 401; sin token → 401;
  segundo cliente → 409; confirmación sin cliente → denegada con timeout.

## T4. Secuencias de escape ANSI/OSC maliciosas en la salida

- **Intenta**: reescribir líneas del terminal (hacerse pasar por la barra de
  confirmación o por un "✓ permitido"), cambiar el título, hipervínculos
  falsos (OSC 8), o colgar el render con líneas kilométricas.
- **Defensas** (Hito 2.4, saneo obligatorio antes de pintar):
  - Eliminar `\x1b`, `\x9b`, CSI/OSC/APC/SOS/PM (`\x1b[...`, `\x1b]...BEL`,
    `\x1bP...`), y C0 salvo `\n` y `\t`.
  - Truncar líneas a 2000 caracteres (con marca `…[truncado]`).
  - La UI real (barra de confirmación, estado) solo se dibuja desde eventos
    estructurados, jamás desde texto.
- **Se prueba**: corpus de cargas (fake-confirm bar, OSC-8 link, title-set,
  CPR request,Charsets raros, mojibake) por pseudo-terminal; captura y
  revisión de que nada se renderiza como UI.

## T5. Binario Go modificado o sustituido

- **Intenta**: una Go troyanizada que envíe turnos maliciosos o robe datos.
- **Defensas**:
  - La Go no guarda ni recibe claves: lo peor que puede hacer es pedir
    turnos, y el MOTOR aplica sandbox + confirmaciones + lista de prohibidos
    igual que con la Go legítima. Daña lo mismo que un usuario descuidado,
    ni más.
  - Distribución con hash verificado en la instalación (Hito 6.2) para que
    "la Go oficial" sea comprobable.
- **Se prueba**: Hito 6 (hash) + la batería adversaria vale contra cualquier
  cliente, legítimo o no.

## Lo que este modelo NO cubre (declarado)

- Un atacante con acceso total a la cuenta del usuario (puede pulsar "sí").
- Modelos gratuitos que registran lo enviado (aviso de primer uso, Hito 5).
- Seguridad del propio proveedor (Kilo/OpenRouter/Groq/Zen).
