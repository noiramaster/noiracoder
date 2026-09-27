package thinclient

// M: menú de comandos "/" + flechas en /connect con historial.
// Sin pty: motor falso httptest (patrón de panel_update_test.go).

import (
	"os"
	"path/filepath"
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

// GG: /deploy, /logout y /login están en el menú con descripción, y el
// menú muestra "comando — descripción".
func TestSlashMenuDeployLogoutLogin(t *testing.T) {
	m, done := testModel(t)
	defer done()
	m.input.SetValue("/")
	m.syncSlash()
	found := map[string]bool{}
	for _, it := range m.slashItems() {
		found[it.Key] = true
		if it.Key == "/deploy" && !strings.Contains(it.Label, "—") {
			t.Fatalf("/deploy sin descripción: %q", it.Label)
		}
	}
	for _, c := range []string{"/deploy", "/logout", "/login"} {
		if !found[c] {
			t.Fatalf("%s falta en el menú", c)
		}
	}
	// /deploy con destino malo enseña uso sin llamar al motor.
	m.input.SetValue("/deploy marciano")
	m.syncSlash()
	if m.slashOpen {
		t.Fatalf("/deploy marciano con espacio debe cerrar el menú")
	}
	m = upd(m, keyPress(tea.KeyEnter))
	if len(m.history) == 0 || m.history[len(m.history)-1] != "/deploy marciano" {
		t.Fatalf("/deploy marciano debe ejecutarse (uso), history=%v", m.history)
	}
	// /logout abre confirmación en cliente, no borra solo.
	m2, done2 := testModel(t)
	defer done2()
	m2.input.SetValue("/logout")
	m2.syncSlash()
	m2 = upd(m2, keyPress(tea.KeyEnter))
	if m2.confirm == nil || m2.confirm.kind != "logout" {
		t.Fatalf("/logout debe pedir confirmación en cliente, confirm=%+v", m2.confirm)
	}
}

// HH: bienvenida de primer arranque con el componente H10.
func TestWelcome(t *testing.T) {
	m, done := testModel(t)
	defer done()
	// Sin sesiones: muestra bloque + opciones welcome.
	m.panel.Items = nil
	m.maybeWelcome()
	if m.options == nil || m.options.id != "welcome" {
		t.Fatalf("primer arranque debe abrir opciones welcome, options=%+v", m.options)
	}
	if len(m.options.items) != 2 || !m.options.items[0].Recommended {
		t.Fatalf("welcome: 2 opciones con la primera recomendada, %+v", m.options.items)
	}
	// El bloque (título + Kilo) va en View como estático, no en el chat.
	v := m.View()
	if !strings.Contains(v, "bienvenido") || !strings.Contains(v, "kilo activo") {
		t.Fatalf("el bloque estático debe mostrar título + Kilo")
	}
	// Elegir "seguir" cierra y marca vista (sin llamar al motor).
	m = upd(m, keyPress(tea.KeyRunes, '2'))
	if m.slashOpen || m.options != nil {
		t.Fatalf("elegir seguir debe cerrar")
	}
	if !welcomeSeen() {
		t.Fatalf("elegir debe marcar welcomed en prefs")
	}
	// Con sesiones no interrumpe.
	m3, done3 := testModel(t)
	defer done3()
	os.Remove(filepath.Join(os.Getenv("NOIRARC_HOME"), ".noirarc", "prefs.json"))
	m3.refreshPanel()
	if len(m3.panel.Items) == 0 {
		t.Fatalf("el motor falso debe dar sesiones para este caso")
	}
	m3.maybeWelcome()
	if m3.options != nil {
		t.Fatalf("con sesiones no debe abrir welcome")
	}
}

// HALLAZGO menú corto: al abrirse debe verse desde la opción 1 (ventana
// desde 0 con el cursor en 0); el scroll solo aparece al navegar.
func TestOptionWindowOpensAtTop(t *testing.T) {
	lo, hi := optionWindow(len(slashCmds), 0)
	if lo != 0 {
		t.Fatalf("al abrir la ventana debe empezar en 0, lo=%d", lo)
	}
	if hi-lo != maxOptionRows {
		t.Fatalf("al abrir la ventana debe ser completa, [%d,%d)", lo, hi)
	}
	// Al navegar, la ventana sigue al cursor (scroll solo entonces).
	lo2, hi2 := optionWindow(len(slashCmds), len(slashCmds)-1)
	if hi2 != len(slashCmds) || lo2 == 0 {
		t.Fatalf("al final la ventana debe seguir al cursor, [%d,%d)", lo2, hi2)
	}
}

// HALLAZGO menú corto: en terminales de pocas filas el frame con el menú
// abierto debe caber en pantalla con la opción 1 visible (antes las filas
// 1-3 se salían por arriba sin forma de verlas).
func TestSlashFitsShortTerminal(t *testing.T) {
	for _, h := range []int{22, 24, 26, 30, 34} {
		m, done := testModel(t)
		m.width, m.height = 100, h
		m.relayout()
		m.input.SetValue("/")
		m.syncSlash()
		if !m.slashOpen || m.slashIdx != 0 {
			done()
			t.Fatalf("H=%d: / debe abrir el menú en idx 0", h)
		}
		v := zoneRe.ReplaceAllString(m.View(), "")
		n := strings.Count(v, "\n") + 1
		if n > h {
			done()
			t.Fatalf("H=%d: el frame (%d líneas) desborda", h, n)
		}
		if !strings.Contains(v, "1. /help") {
			done()
			t.Fatalf("H=%d: la opción 1 debe estar visible", h)
		}
		if !strings.Contains(v, "> NOIRACODER") {
			done()
			t.Fatalf("H=%d: la cabecera debe estar visible", h)
		}
		done()
	}
}
