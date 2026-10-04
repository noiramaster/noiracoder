// PASO 0: regression tests de los 4 bugs (scroll, burbujas, cuota {pct}).
package thinclient

import (
	"strings"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
)

// Up con historial rellena el input (diagnóstico BUG-1: si esto pasa pero en
// pty no, el problema es foco/timing, no la ruta de historial).
func TestUpRecallsHistory(t *testing.T) {
	m, done := testModel(t)
	defer done()
	m.history = []string{"di solo: ok"}
	m.histIdx = -1
	m = upd(m, keyPress(tea.KeyUp))
	if got := m.input.Value(); got != "di solo: ok" {
		t.Fatalf("Up debería recuperar historial, input=%q focus=%v", got, m.panel.Focus)
	}
}
// Sanitize) y el contenido malicioso sí se sanea.
// /help pinta el cuerpo multilínea ÍNTEGRO (diagnóstico checklist §5.1).
// La completitud (los 30 comandos en el catálogo) se verifica con
// check-help-cmds contra screen.ts; aquí solo que el render no lo corta.
func TestHelpListsAll(t *testing.T) {
	m, done := testModel(t)
	defer done()
	SetCatalog(map[string]string{
		"help_title": "Ayuda", "help_section_cmds": "comandos",
		"help_cmds":  "Sesiones: /sessions\nClaves: /connect\nMás: /find",
		"help_section_keys": "teclado", "help_keys": "Teclas:",
		"help_footer": "pie",
	})
	m.input.SetValue("/help")
	m.syncSlash()
	m = upd(m, keyPress(tea.KeyEnter))
	body := strings.Join(m.messages, "\n")
	for _, want := range []string{"Sesiones:", "Claves:", "Más:", "Teclas:", "pie"} {
		if !strings.Contains(body, want) {
			t.Fatalf("falta %q en la ayuda: %q", want, body)
		}
	}
}

// Enter con "/help" exacto ejecuta la ayuda (diagnóstico pty: en algunas
// corridas el Enter parecía no hacer nada).
func TestSlashEnterHelp(t *testing.T) {
	m, done := testModel(t)
	defer done()
	m.input.SetValue("/help")
	m.syncSlash()
	if !m.slashOpen {
		t.Fatalf("el menú / debería abrirse al escribir /help")
	}
	m = upd(m, keyPress(tea.KeyEnter))
	found := false
	for _, ln := range m.messages {
		if strings.Contains(ln, "Comandos:") || strings.Contains(ln, "comandos") {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("Enter en /help debe pintar la ayuda, mensajes=%q", strings.Join(m.messages, " | "))
	}
}

// F1b: Enter con el menú "/" sin coincidencias AVISA (antes moría en
// silencio y el input se quedaba atascado). El texto se conserva.
func TestSlashNoMatchFeedback(t *testing.T) {
	m, done := testModel(t)
	defer done()
	SetCatalog(map[string]string{"slash_no_match": "nada «{q}»"})
	m.input.SetValue("/xyz")
	m.syncSlash()
	if !m.slashOpen {
		t.Fatalf("el menú / debería abrirse con /xyz")
	}
	m = upd(m, keyPress(tea.KeyEnter))
	body := strings.Join(m.messages, "\n")
	if !strings.Contains(body, "/xyz") {
		t.Fatalf("falta el aviso con lo escrito: %q", body)
	}
	if m.slashOpen {
		t.Fatalf("el menú debe cerrarse tras avisar")
	}
	if got := m.input.Value(); got != "/xyz" {
		t.Fatalf("el texto se conserva para corregir, input=%q", got)
	}
}

// F2: escribir texto normal con sugerencias followup abiertas DESCARTA el
// diálogo y la tecla llega al input (antes se tragaba y parecía colgado).
// Los dígitos siguen eligiendo; el resto de diálogos sigue modal.
func TestFollowupTypingDismisses(t *testing.T) {
	m, done := testModel(t)
	defer done()
	mk := func(id string) *optionsState {
		return &optionsState{id: id, prompt: "p",
			items: []optionItem{{Key: "a", Label: "A"}, {Key: "b", Label: "B"}}}
	}
	m.options = mk("followup-t1")
	m = upd(m, keyPress(tea.KeyRunes, 'h'))
	if m.options != nil {
		t.Fatalf("escribir debe descartar el followup")
	}
	if got := m.input.Value(); got != "h" {
		t.Fatalf("la tecla debe llegar al input, input=%q", got)
	}
	// Dígitos: siguen eligiendo opción (rellenan, no envían).
	m.input.SetValue("")
	m.options = mk("followup-t1")
	m = upd(m, keyPress(tea.KeyRunes, '1'))
	if m.options != nil {
		t.Fatalf("el dígito debe resolver la opción")
	}
	if got := m.input.Value(); got != "a" {
		t.Fatalf("el dígito rellena con la opción, input=%q", got)
	}
	// Diálogo no-followup: sigue modal (teclear no lo cierra).
	m.input.SetValue("")
	m.options = mk("welcome")
	m = upd(m, keyPress(tea.KeyRunes, 'h'))
	if m.options == nil {
		t.Fatalf("welcome sigue modal ante texto")
	}
	if got := m.input.Value(); got != "" {
		t.Fatalf("welcome no deja escribir, input=%q", got)
	}
}

// F1a: Enter con turno activo AVISA (turn_busy) en vez de tragarse en silencio.
func TestTurnBusyNotice(t *testing.T) {
	m, done := testModel(t)
	defer done()
	SetCatalog(map[string]string{"turn_busy": "(ocupado)"})
	m.turnID = "t-1"
	m.input.SetValue("hola")
	m = upd(m, keyPress(tea.KeyEnter))
	body := strings.Join(m.messages, "\n")
	if !strings.Contains(body, "(ocupado)") {
		t.Fatalf("falta el aviso de turno activo: %q", body)
	}
}
// WELCOME: con el diálogo de bienvenida abierto (hogar limpio), la vista
// pinta el bloque título + Kilo + nivel ADEMÁS del diálogo (no solo el diálogo).
func TestWelcomeBlockPaints(t *testing.T) {
	m, done := testModel(t)
	defer done()
	SetCatalog(map[string]string{
		"welcome_title": "TITULO", "welcome_kilo": "KILO", "welcome_line3": "NIVEL medio",
		"welcome_line2": "l2", "welcome_more": "MAS-CUOTA",
		"welcome_connect": "conectar", "welcome_skip": "seguir",
		"options_title": "elige",
		"st_model": "modelo", "st_mode": "modo", "st_session": "sesión",
		"hints": "h", "prompt_ph": "ph",
		"panel_new": "+ Nueva", "panel_all": "todas", "panel_project": "proyecto",
		"panel_hint": "h", "panel_hint_esc": "esc",
	})
	m.panel.Items = nil // hogar limpio: sin sesiones
	m.width, m.height = 100, 50 // alta para que quepan las 2 opciones
	m.relayout()
	m.maybeWelcome()
	if m.options == nil || m.options.id != "welcome" {
		t.Fatalf("hogar limpio debe abrir el diálogo welcome")
	}
	v := m.View()
	// El bloque (lo que faltaba en pty) + el diálogo con su primera opción.
	// (La 2ª opción puede quedar tras "1 más abajo" por la ventana HALLAZGO;
	// eso lo cubre el pty, aquí importa el bloque.)
	for _, want := range []string{"TITULO", "KILO", "NIVEL", "elige", "conectar"} {
		if !strings.Contains(v, want) {
			t.Fatalf("falta %q en la vista de bienvenida:\n%s", want, v)
		}
	}
}
// SCROLL-PTY: escribir (espacio, d, j...) NO mueve la vista. El viewport
// traía atajos de pager (espacio=PageDown, d=media página) y cada tecla
// pasaba por viewport.Update: teclear arrastraba abajo aunque el streaming
// respetara el scroll. Causa real del "yank" en pty.
func TestTypingNeverScrolls(t *testing.T) {
	m, done := testModel(t)
	defer done()
	for i := 0; i < 120; i++ {
		m.addLine("línea de relleno para desbordar el viewport")
	}
	m.viewport.LineUp(10)
	y0 := m.viewport.YOffset
	if m.viewport.AtBottom() {
		t.Fatalf("tras LineUp(10) debería estar fuera del fondo")
	}
	for _, r := range []rune{' ', 'd', 'j', 'k', 'u', 'f', 'h', 'l'} {
		m = upd(m, keyPress(tea.KeyRunes, r))
		m.input.SetValue("") // no ensuciar (aquí solo importa el viewport)
	}
	if m.viewport.YOffset != y0 {
		t.Fatalf("teclear movió la vista: %d -> %d", y0, m.viewport.YOffset)
	}
}

// La burbuja conserva el prefijo con estilo (el ANSI del dorado NO lo come
// Sanitize) y el contenido malicioso sí se sanea.
func TestBubbleKeepsStyle(t *testing.T) {
	m, done := testModel(t)
	defer done()
	m.addBubbleLine("user", "hola\x1b[31mX")
	last := m.messages[len(m.messages)-1]
	if !strings.Contains(last, "▶ ") {
		t.Fatalf("falta el marcador ▶ en %q", last)
	}
	if strings.Contains(last, "[31m") {
		t.Fatalf("el ANSI del contenido debe sanearse: %q", last)
	}
	want := bubblePrefix("user") + "holaX"
	if last != want {
		t.Fatalf("prefijo alterado: got %q want %q", last, want)
	}
}

// Scrollear arriba y que llegue una línea NO te arrastra al fondo.
func TestScrollStaysUp(t *testing.T) {
	m, done := testModel(t)
	defer done()
	for i := 0; i < 120; i++ {
		m.addLine("línea de relleno para desbordar el viewport")
	}
	m.viewport.LineUp(10)
	y0 := m.viewport.YOffset
	if m.viewport.AtBottom() {
		t.Fatalf("tras LineUp(10) debería estar fuera del fondo")
	}
	m.addLine("línea nueva durante lectura")
	if m.viewport.YOffset != y0 {
		t.Fatalf("el yank movió el viewport: %d -> %d", y0, m.viewport.YOffset)
	}
	// Y si estabas abajo, sí baja (comportamiento de chat normal).
	m.viewport.GotoBottom()
	m.addLine("otra más")
	if !m.viewport.AtBottom() {
		t.Fatalf("estando abajo debe seguir bajando")
	}
}

// Catálogo viejo ("q {pct}%") + binario nuevo: el % se calcula, no se ve {pct}.
func TestQuotaPctFallback(t *testing.T) {
	m, done := testModel(t)
	defer done()
	SetCatalog(map[string]string{
		"st_model": "model", "st_mode": "mode", "st_session": "session",
		"st_quota": "q {pct}%",
	})
	m.quotaUsed, m.quotaTotal = 25, 100
	m.setStatus()
	if strings.Contains(m.status, "{pct}") {
		t.Fatalf("placeholder sin resolver: %q", m.status)
	}
	if !strings.Contains(m.status, "25%") {
		t.Fatalf("falta el pct calculado: %q", m.status)
	}
	// Plantilla nueva: números usados/total.
	SetCatalog(map[string]string{
		"st_model": "model", "st_mode": "mode", "st_session": "session",
		"st_quota": "q {used}/{total}",
	})
	m.setStatus()
	if !strings.Contains(m.status, "25/100") {
		t.Fatalf("faltan números: %q", m.status)
	}
}

// El diálogo modal responde y/n aunque el panel tenga el foco (antes el
// panel consumía la tecla y borrar sesión quedaba clavado).
func TestConfirmBeatsPanelFocus(t *testing.T) {
	m, done := testModel(t)
	defer done()
	m.panel.Focus = true
	m.confirm = &confirmState{kind: "delsess", detail: "borrar", sessID: "id-a"}
	m = upd(m, keyPress(tea.KeyRunes, 'y'))
	if m.confirm != nil {
		t.Fatalf("la 'y' debe resolver el diálogo aunque el panel tenga foco")
	}
}

// El primer texto tras "pensando" REEMPLAZA la línea (no se pega detrás).
func TestThinkReplace(t *testing.T) {
	m, done := testModel(t)
	defer done()
	m.onEvent(Event{Name: "turn.thinking", Data: map[string]any{}})
	if !m.thinkShown {
		t.Fatalf("thinking debe marcar thinkShown")
	}
	m.onEvent(Event{Name: "turn.text", Data: map[string]any{"delta": "hola"}})
	if m.thinkShown {
		t.Fatalf("el primer texto debe limpiar thinkShown")
	}
	last := m.messages[len(m.messages)-1]
	if !strings.Contains(last, "hola") {
		t.Fatalf("falta la respuesta: %q", last)
	}
	// Sin rastro del pensando en la misma línea (ni clave ni texto).
	if strings.Contains(last, "turn_thinking") || strings.Contains(last, "pensando") {
		t.Fatalf("pensando pegado a la respuesta: %q", last)
	}
}
