// M2 — panel lateral izquierdo de sesiones (cliente fino).
// La lista viene del motor (título + metadatos, nunca contenido).
package thinclient

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss"
	"github.com/mattn/go-runewidth"
	tea "github.com/charmbracelet/bubbletea"
	zone "github.com/lrstanley/bubblezone"
)

// PanelWidth es el ancho fijo del panel (2.1: ~26-32).
const PanelWidth = 28

// MinFullWidth: por debajo el panel deja de ir al lado y se abre como hoja.
const MinFullWidth = 80

// PanelItem es una fila (metadatos del motor).
type PanelItem struct {
	ID     string
	Nombre string
	Rel    string
	Grupo  string
	Turnos int
	Fija   bool
	Activa bool
}

// Panel guarda el estado del lateral.
type Panel struct {
	Open   bool
	Focus  bool
	All    bool
	Items  []PanelItem
	Idx    int
	Filter string
	// Tecla pendiente (desambiguación escritura vs comando, M2.2).
	pending     rune
	pendingGen  int
}

// pendingTimeoutMsg dispara la acción pendiente si no se escribió más.
type pendingTimeoutMsg struct{ gen int }

// cmdRunes son las letras de acción inmediata (solo con filtro vacío).
func isPanelCmd(r rune) bool {
	return r == 'n' || r == 'a' || r == 'f' || r == 'd' || r == 'r'
}

// panelFiltered aplica el filtro de búsqueda (escribir filtra).
func (m *Model) panelFiltered() []PanelItem {
	if m.panel.Filter == "" {
		return m.panel.Items
	}
	q := strings.ToLower(m.panel.Filter)
	var out []PanelItem
	for _, it := range m.panel.Items {
		if strings.Contains(strings.ToLower(it.Nombre), q) {
			out = append(out, it)
		}
	}
	return out
}

// refreshPanel trae la lista del motor (proyecto o todas).
func (m *Model) refreshPanel() {
	list, err := m.client.SessionsExt(m.panel.All)
	if err != nil {
		return
	}
	items := make([]PanelItem, 0, len(list))
	for _, s := range list {
		items = append(items, PanelItem{
			ID: s.ID, Nombre: s.Nombre, Rel: s.Rel, Grupo: s.Grupo,
			Turnos: s.Turnos, Fija: s.Fija, Activa: s.Activa,
		})
	}
	m.panel.Items = items
	if m.panel.Idx >= len(items) {
		m.panel.Idx = len(items) - 1
	}
	if m.panel.Idx < 0 && len(items) > 0 {
		m.panel.Idx = 0
	}
}

// panelRow pinta una fila (~28 cols): marca + nombre + rel.
func panelRow(lang string, it PanelItem, current, sel bool) string {
	mark := " "
	if current {
		mark = "*"
	}
	suf := ""
	if it.Activa {
		suf = "~"
	} else if it.Fija {
		suf = "!"
	}
	name := runewidth.Truncate(it.Nombre, 16, "…")
	rel := runewidth.Truncate(it.Rel, 6, "…")
	row := mark + " " + name + " " + rel + suf
	row = runewidth.Truncate(row, PanelWidth-2, "…")
	if sel {
		return lipgloss.NewStyle().Reverse(true).Render(row)
	}
	if current {
		return lipgloss.NewStyle().Bold(true).Render(row)
	}
	return row
}

// renderPanel pinta el lateral (cabecera + grupos + filas + ayuda).
func (m *Model) renderPanel() string {
	w := PanelWidth
	var b strings.Builder
	focusMark := "  "
	if m.panel.Focus {
		focusMark = "> "
	}
	newBtn := zone.Mark("pnew", focusMark+T(m.lang, "panel_new"))
	b.WriteString(newBtn + "\n")
	scope := T(m.lang, "panel_project")
	if m.panel.All {
		scope = T(m.lang, "panel_all")
	}
	b.WriteString(zone.Mark("pall", "["+scope+"]"))
	if m.panel.Filter != "" {
		b.WriteString(" /" + runewidth.Truncate(m.panel.Filter, 12, "…"))
	}
	b.WriteString("\n")
	b.WriteString(strings.Repeat("─", w-2) + "\n")
	items := m.panelFiltered()
	if len(items) == 0 {
		b.WriteString(T(m.lang, "no_sessions") + "\n")
	}
	lastGroup := ""
	for i, it := range items {
		if it.Grupo != "" && it.Grupo != lastGroup {
			lastGroup = it.Grupo
			b.WriteString(lipgloss.NewStyle().Bold(true).Render(runewidth.Truncate(lastGroup, w-2, "…")) + "\n")
		}
		row := panelRow(m.lang, it, it.ID == m.sessionID, m.panel.Focus && i == m.panel.Idx)
		b.WriteString(zone.Mark("psess:"+it.ID, row) + "\n")
	}
	for _, ln := range strings.Split(T(m.lang, "panel_hint"), "·") {
		ln = strings.TrimSpace(ln)
		if ln == "" {
			continue
		}
		b.WriteString(lipgloss.NewStyle().Foreground(muted).Render(runewidth.Truncate("· "+ln, w-2, "")) + "\n")
	}
	box := lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(border).
		Width(w).Padding(0, 1)
	if m.panel.Focus {
		box = box.BorderForeground(yellow)
	}
	return box.Render(strings.TrimRight(b.String(), "\n"))
}

// openSession abre una sesión por id (historial + estado + persistencia).
func (m *Model) openSession(id string) {
	turns, name, err := m.client.History(id)
	if err != nil {
		m.addLine(T(m.lang, "err_resume") + err.Error())
		return
	}
	m.sessionID = id
	m.sessName = name
	m.messages = nil
	for _, t := range turns {
		if t.Role == "user" {
			m.addLine("> " + t.Content)
		} else {
			m.addLine(t.Content)
		}
	}
	m.setStatus()
	m.refreshPanel()
	m.client.SetUi(m.panel.Open, id)
}

// welcomeSeen dice si ya se mostró la bienvenida HH (una sola vez).
func welcomeSeen() bool {
	home := os.Getenv("NOIRARC_HOME")
	if home == "" {
		if h, err := os.UserHomeDir(); err == nil {
			home = h
		} else {
			return false
		}
	}
	b, err := os.ReadFile(filepath.Join(home, ".noirarc", "prefs.json"))
	if err != nil {
		return false
	}
	var v struct {
		Welcomed *bool `json:"welcomed"`
	}
	if err := json.Unmarshal(b, &v); err != nil || v.Welcomed == nil {
		return false
	}
	return *v.Welcomed
}

// setWelcomeSeen marca la bienvenida como vista (merge, no pisa prefs).
func setWelcomeSeen() {
	home := os.Getenv("NOIRARC_HOME")
	if home == "" {
		if h, err := os.UserHomeDir(); err == nil {
			home = h
		} else {
			return
		}
	}
	dir := filepath.Join(home, ".noirarc")
	p := filepath.Join(dir, "prefs.json")
	var v map[string]any
	if b, err := os.ReadFile(p); err == nil {
		_ = json.Unmarshal(b, &v)
	}
	if v == nil {
		v = map[string]any{}
	}
	v["welcomed"] = true
	if b, err := json.Marshal(v); err == nil {
		_ = os.MkdirAll(dir, 0755)
		_ = os.WriteFile(p, b, 0644)
	}
}

// mousePref lee el flag de ratón (defecto true).
func mousePref() bool {
	home := os.Getenv("NOIRARC_HOME")
	if home == "" {
		if h, err := os.UserHomeDir(); err == nil {
			home = h
		} else {
			return true
		}
	}
	b, err := os.ReadFile(filepath.Join(home, ".noirarc", "prefs.json"))
	if err != nil {
		return true
	}
	var v struct {
		Mouse *bool `json:"mouse"`
	}
	if err := json.Unmarshal(b, &v); err != nil || v.Mouse == nil {
		return true
	}
	return *v.Mouse
}

// saveMousePref guarda on|off mezclando el JSON existente.
func saveMousePref(on bool) {
	home := os.Getenv("NOIRARC_HOME")
	if home == "" {
		if h, err := os.UserHomeDir(); err == nil {
			home = h
		} else {
			return
		}
	}
	p := filepath.Join(home, ".noirarc", "prefs.json")
	var v map[string]any
	if b, err := os.ReadFile(p); err == nil {
		_ = json.Unmarshal(b, &v)
	}
	if v == nil {
		v = map[string]any{}
	}
	v["mouse"] = on
	os.MkdirAll(filepath.Join(home, ".noirarc"), 0o755)
	b, _ := json.MarshalIndent(v, "", "  ")
	_ = os.WriteFile(p, append(b, '\n'), 0o644)
}

// panelEnter abre la seleccionada (o crea) / confirma renombrado.
func (m *Model) panelEnter() (tea.Model, tea.Cmd) {
	if m.renaming {
		name := strings.TrimSpace(m.input.Value())
		m.input.Reset()
		m.renaming = false
		items := m.panelFiltered()
		if name != "" && m.panel.Idx >= 0 && m.panel.Idx < len(items) {
			if nn, _, err := m.client.PatchSession(items[m.panel.Idx].ID, name, nil); err != nil {
				m.addLine(T(m.lang, "err_sessions") + err.Error())
			} else {
				m.addLine(F(m.lang, "model_set", map[string]string{"model": nn}))
				if items[m.panel.Idx].ID == m.sessionID {
					m.sessName = Sanitize(nn)
					m.setStatus()
				}
				m.refreshPanel()
			}
		}
		return m, nil
	}
	items := m.panelFiltered()
	if m.panel.Idx < 0 || m.panel.Idx >= len(items) {
		m.newSession()
		return m, nil
	}
	m.openSession(items[m.panel.Idx].ID)
	return m, nil
}

// newSession empieza una local (el servidor la crea al primer turno).
func (m *Model) newSession() {
	m.sessionID = ""
	m.sessName = ""
	m.messages = nil
	m.viewport.SetContent("")
	m.addLine(T(m.lang, "new_session"))
	m.setStatus()
	m.refreshPanel()
	m.client.SetUi(m.panel.Open, "")
}

// handlePanelKey gestiona el foco del panel (M2.2). true = consumida.
func (m *Model) handlePanelKey(msg tea.KeyMsg) (tea.Model, tea.Cmd, bool) {
	if !m.panel.Focus || m.confirm != nil {
		return m, nil, false
	}
	// Renombrando: todo va a la caja salvo Enter/Esc.
	if m.renaming {
		if msg.Type == tea.KeyEsc {
			m.renaming = false
			m.input.Reset()
			return m, nil, true
		}
		return m, nil, false
	}
	// CR/LF como runas: lo gestiona doEnter (no el filtro).
	if msg.Type == tea.KeyRunes && (string(msg.Runes) == "\r" || string(msg.Runes) == "\n") {
		return m, nil, false
	}
	// Pendiente anterior: Esc la cancela; otra tecla no-runa-simple significa
	// que era escritura (se vuelca al filtro); runa simple la junta el caso.
	if m.panel.pending != 0 {
		if msg.Type == tea.KeyEsc {
			m.panel.pending = 0
			m.panel.pendingGen++
			return m, nil, false
		}
		if !(msg.Type == tea.KeyRunes && len(msg.Runes) == 1) {
			m.appendFilter(string([]rune{m.panel.pending}))
			m.panel.pending = 0
			m.panel.pendingGen++
		}
	}
	items := m.panelFiltered()
	switch msg.Type {
	case tea.KeyUp:
		if m.panel.Idx > 0 {
			m.panel.Idx--
		}
		return m, nil, true
	case tea.KeyDown:
		if m.panel.Idx < len(items)-1 {
			m.panel.Idx++
		}
		return m, nil, true
	case tea.KeyBackspace, tea.KeyDelete:
		if len(m.panel.Filter) > 0 {
			m.panel.Filter = m.panel.Filter[:len(m.panel.Filter)-1]
			m.panel.Idx = 0
		}
		return m, nil, true
	case tea.KeySpace:
		m.panel.Filter += " "
		m.panel.Idx = 0
		return m, nil, true
	case tea.KeyRunes:
		rs := msg.Runes
		// Ráfaga (pegado o teclas coalescadas): siempre es texto a filtrar,
		// nunca un comando. Así "beta"/"dos" no disparan nada.
		if len(rs) != 1 {
			m.appendFilter(string(rs))
			return m, nil, true
		}
		r := rs[0]
		// Tecla pendiente anterior: era escritura, no comando.
		if m.panel.pending != 0 {
			m.appendFilter(string([]rune{m.panel.pending, r}))
			m.panel.pending = 0
			m.panel.pendingGen++
			return m, nil, true
		}
		// Letra de comando SOLA con filtro vacío: espera 500 ms por si se
		// sigue escribiendo ("dos" rápido filtra; "d" sola + pausa actúa).
		// Con filtro no vacío siempre se añade (nunca se dispara).
		if m.panel.Filter == "" && isPanelCmd(r) {
			m.panel.pending = r
			m.panel.pendingGen++
			gen := m.panel.pendingGen
			return m, tea.Tick(500*time.Millisecond, func(time.Time) tea.Msg {
				return pendingTimeoutMsg{gen: gen}
			}), true
		}
		// Resto: filtrar.
		m.appendFilter(string(r))
		return m, nil, true
	}
	return m, nil, false
}

// appendFilter añade al filtro y centra el índice.
func (m *Model) appendFilter(s string) {
	for _, r := range s {
		if r >= 32 && r != 127 {
			m.panel.Filter += string(r)
			m.panel.Idx = 0
		}
	}
}

// panelTimeout ejecuta la acción pendiente si nadie escribió después.
func (m *Model) panelTimeout(gen int) (tea.Model, tea.Cmd) {
	if gen != m.panel.pendingGen || m.panel.pending == 0 {
		return m, nil
	}
	r := m.panel.pending
	m.panel.pending = 0
	m.panel.pendingGen++
	items := m.panelFiltered()
	switch r {
	case 'n':
		m.newSession()
		return m, nil
	case 'a':
		m.panel.All = !m.panel.All
		m.panel.Idx = 0
		m.refreshPanel()
		return m, nil
	case 'f':
		if m.panel.Idx >= 0 && m.panel.Idx < len(items) {
			pin := !items[m.panel.Idx].Fija
			if _, _, err := m.client.PatchSession(items[m.panel.Idx].ID, "", &pin); err != nil {
				m.addLine(T(m.lang, "err_sessions") + err.Error())
			} else {
				m.refreshPanel()
			}
		}
		return m, nil
	case 'd':
		if m.panel.Idx >= 0 && m.panel.Idx < len(items) {
			m.confirm = &confirmState{kind: "delsess", sessID: items[m.panel.Idx].ID, detail: items[m.panel.Idx].Nombre}
		}
		return m, nil
	case 'r':
		if m.panel.Idx >= 0 && m.panel.Idx < len(items) {
			m.renaming = true
			m.input.SetValue(items[m.panel.Idx].Nombre)
		}
		return m, nil
	}
	return m, nil
}

// handleMouse: rueda = chat; clic = panel/botones (M2.5).
func (m *Model) handleMouse(msg tea.MouseMsg) (tea.Model, tea.Cmd) {
	switch {
	case msg.Button == tea.MouseButtonWheelUp:
		m.viewport.LineUp(3)
		return m, nil
	case msg.Button == tea.MouseButtonWheelDown:
		m.viewport.LineDown(3)
		return m, nil
	case msg.Action == tea.MouseActionPress && msg.Button == tea.MouseButtonLeft:
		// M: clic en el menú de "/" (mismo componente que las opciones H10).
		if m.slashOpen {
			for i := range m.slashItems() {
				if z := zone.Get("slash:" + strconv.Itoa(i)); z != nil && z.InBounds(msg) {
					m.slashPick(i)
					return m, nil
				}
			}
		}
		// H10: clic en una fila del diálogo de opciones.
		if m.options != nil {
			for i := range m.options.items {
				if z := zone.Get("opt:" + strconv.Itoa(i)); z != nil && z.InBounds(msg) {
					o := m.options
					m.resolveOptionsLocal(o, i, false)
					return m, nil
				}
			}
		}
		if z := zone.Get("pnew"); z != nil && z.InBounds(msg) {
			m.newSession()
			return m, nil
		}
		if z := zone.Get("pall"); z != nil && z.InBounds(msg) {
			m.panel.All = !m.panel.All
			m.panel.Idx = 0
			m.panel.Focus = true
			m.refreshPanel()
			return m, nil
		}
		for _, it := range m.panel.Items {
			if z := zone.Get("psess:" + it.ID); z != nil && z.InBounds(msg) {
				m.panel.Focus = true
				m.openSession(it.ID)
				return m, nil
			}
		}
		// Clic en el panel sin zona: solo enfoca.
		if m.panel.Open && msg.X < PanelWidth+2 {
			m.panel.Focus = true
			return m, nil
		}
	}
	return m, nil
}
