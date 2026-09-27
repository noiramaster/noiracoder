package thinclient

// M: menú de comandos "/" + flechas en /connect con historial.
// Sin pty: motor falso httptest (patrón de panel_update_test.go).

import (
	"regexp"
	"strings"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/muesli/termenv"
)

// zoneRe quita las marcas CSI de bubblezone ("…z") sin tocar los SGR ("…m").
var zoneRe = regexp.MustCompile("\x1b\\[[0-9]+z")

// M1: con opciones H10 abiertas, las flechas mueven EL CURSOR aunque haya
// historial. Antes, el historial se las comía y /connect prometía
// "flechas+Enter" sin cumplirlo.
func TestOptionsArrowsBeatHistory(t *testing.T) {
	m, done := testModel(t)
	defer done()
	m.history = []string{"/sessions", "/help"}
	m.histIdx = -1
	m.options = &optionsState{id: "connect-form", prompt: "p",
		items: []optionItem{{Key: "a", Label: "A"}, {Key: "b", Label: "B"}}, idx: 0}

	m = upd(m, keyPress(tea.KeyDown))
	if m.options == nil || m.options.idx != 1 {
		t.Fatalf("down debe mover el cursor de opciones (idx=1), options=%+v", m.options)
	}
	if m.histIdx != -1 {
		t.Fatalf("down no debe tocar el historial con opciones abiertas, histIdx=%d", m.histIdx)
	}
	m = upd(m, keyPress(tea.KeyUp))
	if m.options == nil || m.options.idx != 0 {
		t.Fatalf("up debe devolver el cursor a 0, options=%+v", m.options)
	}
	// Sin opciones, las flechas sí son historial (no se rompió lo viejo).
	m.options = nil
	m = upd(m, keyPress(tea.KeyUp))
	if m.histIdx == -1 || m.input.Value() == "" {
		t.Fatalf("sin opciones, up debe navegar el historial, histIdx=%d input=%q", m.histIdx, m.input.Value())
	}
}

// M2: "/" abre el menú con todos los comandos; escribir filtra; flechas
// navegan; número elige; Enter con coincidencia exacta EJECUTA.
func TestSlashMenu(t *testing.T) {
	m, done := testModel(t)
	defer done()

	m = upd(m, keyPress(tea.KeyRunes, '/'))
	if !m.slashOpen {
		t.Fatalf("escribir / debe abrir el menú, input=%q", m.input.Value())
	}
	if n := len(m.slashItems()); n != len(slashCmds) {
		t.Fatalf("con / solo debe listar todo: %d de %d", n, len(slashCmds))
	}
	for _, r := range "con" {
		m = upd(m, keyPress(tea.KeyRunes, r))
	}
	got := []string{}
	for _, it := range m.slashItems() {
		got = append(got, it.Key)
	}
	if len(got) != 2 || got[0] != "/connections" || got[1] != "/connect" {
		t.Fatalf("filtro /con debe dejar [/connections /connect], got=%v", got)
	}
	m = upd(m, keyPress(tea.KeyDown))
	if m.slashIdx != 1 {
		t.Fatalf("down debe mover el cursor del menú a 1, idx=%d", m.slashIdx)
	}
	// Número elige y rellena la entrada (no ejecuta).
	m = upd(m, keyPress(tea.KeyRunes, '1'))
	if m.slashOpen || strings.TrimSpace(m.input.Value()) != "/connections" {
		t.Fatalf("1 debe rellenar /connections y cerrar, open=%v input=%q", m.slashOpen, m.input.Value())
	}
	// Enter con coincidencia exacta ejecuta el comando (aquí /help, local).
	m.input.SetValue("/help")
	m.syncSlash()
	if !m.slashOpen {
		t.Fatalf("/help exacto debe mantener el menú para el Enter")
	}
	m = upd(m, keyPress(tea.KeyEnter))
	if m.slashOpen {
		t.Fatalf("Enter con /help exacto debe ejecutar y cerrar el menú")
	}
	if len(m.history) == 0 || m.history[len(m.history)-1] != "/help" {
		t.Fatalf("/help debe quedar en el historial, history=%v", m.history)
	}
	// "/connect" es exacto aunque "/connections" también case por prefijo:
	// Enter debe ejecutarlo, no elegir el primero.
	if !isSlashCmd("/connect") || !isSlashCmd("/connections") || isSlashCmd("/con") {
		t.Fatalf("isSlashCmd mal: /connect y /connections sí, /con no")
	}
	// Esc cierra sin ejecutar.
	m.input.SetValue("/mod")
	m.syncSlash()
	if !m.slashOpen {
		t.Fatalf("/mod debe abrir el menú")
	}
	m = upd(m, keyPress(tea.KeyEsc))
	if m.slashOpen {
		t.Fatalf("Esc debe cerrar el menú")
	}
}

// M+N: la fila activa del componente lleva el acento #FBBF24 (--accent de la
// landing) y la caja respira (padding), con bordes redondeados cortos.
func TestOptionsBoxAccent(t *testing.T) {
	m, done := testModel(t)
	defer done()
	// Sin TTY lipgloss degradaría a ASCII y no habría SGR que verificar.
	// Solo en este test (global): se restaura al salir para no romper otros.
	lipgloss.SetColorProfile(termenv.TrueColor)
	defer lipgloss.SetColorProfile(termenv.Ascii)
	box := m.renderOptionsBox("Elige:", []optionItem{{Key: "a", Label: "Alfa"}, {Key: "b", Label: "Beto"}}, 1, "t")
	i := strings.Index(box, "▸")
	if i < 0 {
		t.Fatalf("la caja debe marcar la fila activa con ▸:\n%s", box)
	}
	// bubblezone marca con CSI "…z"; se quitan para ver el color real.
	clean := zoneRe.ReplaceAllString(box, "")
	j := strings.Index(clean, "▸")
	seg := clean[max(0, j-60):j]
	k := strings.LastIndex(seg, "38;2;251;191;36")
	if k < 0 || strings.Contains(seg[k:], "\x1b[0m") {
		t.Fatalf("el cursor ▸ debe llevar el acento #FBBF24 sin reset antes: %q", seg)
	}
	// El texto de la fila activa va en inversa (visible hasta en ConPTY,
	// donde el SGR combinado negrita+truecolor se pierde).
	rest := clean[j:]
	if !strings.Contains(rest[:min(len(rest), 60)], "7m") {
		t.Fatalf("la fila activa debe ir en inversa: %q", rest[:min(len(rest), 60)])
	}
	if !strings.Contains(box, "╭") || strings.Contains(box, "╔") || strings.Contains(box, "┏") {
		t.Fatalf("bordes redondeados cortos, sin caja pesada")
	}
}

// N: la vista cabe en la pantalla (la cabecera de 2 líneas + aire no deben
// empujar la primera línea fuera por arriba).
func TestViewFitsHeight(t *testing.T) {
	m, done := testModel(t)
	defer done()
	m.width, m.height = 100, 30
	m.relayout()
	v := m.View()
	n := strings.Count(v, "\n") + 1
	if n > m.height+2 {
		t.Fatalf("la vista (%d líneas) desborda la pantalla (%d)", n, m.height)
	}
	if !strings.Contains(v, "> NOIRACODER") {
		t.Fatalf("la cabecera debe estar visible")
	}
}
