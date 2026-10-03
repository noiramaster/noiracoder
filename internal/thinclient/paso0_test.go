// PASO 0: regression tests de los 4 bugs (scroll, burbujas, cuota {pct}).
package thinclient

import (
	"strings"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
)

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
