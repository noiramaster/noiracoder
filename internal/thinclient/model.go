// UI del cliente fino (Hito 1): pantalla completa, chat + entrada + estado.
// Sin i18n aún (Hito 3.6): español por defecto.
package thinclient

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/charmbracelet/bubbles/textarea"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/mattn/go-runewidth"
	"github.com/atotto/clipboard"
	zone "github.com/lrstanley/bubblezone"
)

type evMsg struct{ ev Event }
type evErr struct{ err error }

type confirmState struct {
	id     string
	detail string
	// kind "" = herramienta; "delsess" = borrar sesión (sessID).
	kind   string
	sessID string
}

type Model struct {
	client    *Client
	lang      string
	viewport  viewport.Model
	input     textarea.Model
	messages  []string
	status    string
	modelName string
	mode      string
	quotaPct  int
	sessionID string
	sessName  string
	turnID    string
	thinking  bool
	confirm   *confirmState
	fatal     string
	history   []string
	histIdx   int
	width     int
	height    int
	chatW     int
	program   *tea.Program
	panel     Panel
	mouseOn   bool
	renaming  bool
}

var (
	gold    = lipgloss.Color("#FBBF24")
	green   = lipgloss.Color("#22c55e")
	red     = lipgloss.Color("#ef4444")
	yellow  = lipgloss.Color("#eab308")
	magenta = lipgloss.Color("#D63384")
	muted   = lipgloss.Color("#666666")
	border  = lipgloss.Color("#222222")
)

// New crea el modelo y arranca el stream de eventos.
func New(c *Client) *Model {
	lang := c.Lang
	if lang == "" {
		lang = DetectLang()
	}
	ta := textarea.New()
	ta.Placeholder = T(lang, "prompt_ph")
	ta.Focus()
	ta.SetHeight(3)
	vp := viewport.New(80, 20)
	m := &Model{
		client:    c,
		lang:      lang,
		viewport:  vp,
		input:     ta,
		modelName: "(router)",
		mode:      "build",
		histIdx:   -1,
		panel:     Panel{Open: true},
		mouseOn:   mousePref(),
	}
	m.setStatus()
	return m
}

// Attach conecta el programa para reenviar eventos del stream.
func (m *Model) Attach(p *tea.Program) {
	m.program = p
	go m.client.Stream(
		func(ev Event) { p.Send(evMsg{ev}) },
		func(err error) { p.Send(evErr{err}) },
	)
}

// MouseOn dice si la captura de ratón está activa (M2.5).
func (m *Model) MouseOn() bool { return m.mouseOn }

func (m *Model) Init() tea.Cmd { return textarea.Blink }

func (m *Model) addLine(s string) {
	m.messages = append(m.messages, Sanitize(s))
	if len(m.messages) > 500 {
		m.messages = m.messages[len(m.messages)-500:]
	}
	m.viewport.SetContent(strings.Join(m.messages, "\n"))
	m.viewport.GotoBottom()
}

func (m *Model) setStatus() {
	// M3.3: status bar mejorada con separadores y barra de cuota visual.
	modelStr := m.modelName
	if m.modelName != "(router)" {
		modelStr = lipgloss.NewStyle().Foreground(magenta).Render(m.modelName)
	}
	parts := []string{
		lipgloss.NewStyle().Foreground(muted).Render(T(m.lang, "st_model")) + ": " + modelStr,
		lipgloss.NewStyle().Foreground(muted).Render(T(m.lang, "st_mode")) + ": " + m.mode,
		lipgloss.NewStyle().Foreground(muted).Render(T(m.lang, "st_session")) + ": " + or(m.sessName, "—"),
	}
	if m.quotaPct > 0 {
		// M3.3: barra de cuota visual (█ vacío).
		filled := m.quotaPct / 10
		empty := 10 - filled
		bar := strings.Repeat("█", filled) + strings.Repeat("░", empty)
		barColor := green
		if m.quotaPct >= 80 {
			barColor = yellow
		}
		if m.quotaPct >= 95 {
			barColor = red
		}
		parts = append(parts, lipgloss.NewStyle().Foreground(muted).Render(T(m.lang, "st_quota")+": ")+
			lipgloss.NewStyle().Foreground(barColor).Render(bar)+
			lipgloss.NewStyle().Foreground(muted).Render(fmt.Sprintf(" %d%%", m.quotaPct)))
	}
	if m.thinking {
		parts = append(parts, F(m.lang, "st_thinking", map[string]string{"model": m.modelName}))
	}
	if m.turnID != "" {
		parts = append(parts, T(m.lang, "st_turn"))
	}
	m.status = fitStatus(parts, m.chatW, m)
}

// fitStatus recorta con prioridad M1.8: primero el nombre de sesión, luego
// el modelo; modo, cuota y avisos no se tocan. Ancho visual (runewidth: CJK
// doble). Si ni al mínimo cabe, se devuelve lo mínimo recortado.
func fitStatus(parts []string, width int, m *Model) string {
	joined := strings.Join(parts, " · ")
	if width <= 0 || runewidth.StringWidth(joined) <= width {
		return joined
	}
	sessLabel := T(m.lang, "st_session") + ": "
	modelLabel := T(m.lang, "st_model") + ": "
	restW := 0
	nRest := 0
	for i, p := range parts {
		if i == 0 || i == 2 {
			continue
		}
		restW += runewidth.StringWidth(p)
		nRest++
	}
	seps := len(parts) - 1 // uniones " · " entre todos
	fixed := restW + seps*3 + runewidth.StringWidth(sessLabel) + runewidth.StringWidth(modelLabel)
	avail := width - fixed
	// Modelo: hasta 25, mínimo 8. Sesión: el resto, mínimo 6.
	modelBudget := 25
	if avail-6 < modelBudget {
		modelBudget = avail - 6
	}
	if modelBudget < 8 {
		modelBudget = 8
	}
	sessBudget := avail - modelBudget
	if sessBudget < 6 {
		sessBudget = 6
	}
	parts[0] = modelLabel + runewidth.Truncate(m.modelName, modelBudget, "…")
	sess := or(m.sessName, "—")
	parts[2] = sessLabel + runewidth.Truncate(sess, sessBudget, "…")
	joined = strings.Join(parts, " · ")
	if runewidth.StringWidth(joined) <= width {
		return joined
	}
	// M1.8: ventana estrecha (<60): la barra pasa a DOS líneas para no
	// perder información (modelo·modo / sesión·cuota·avisos).
	line1 := parts[0] + " · " + parts[1]
	rest2 := []string{parts[2]}
	if len(parts) > 3 {
		rest2 = append(rest2, parts[3:]...)
	}
	return line1 + "\n" + strings.Join(rest2, " · ")
}

func or(a, b string) string {
	if a != "" {
		return a
	}
	return b
}

func (m *Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width, m.height = msg.Width, msg.Height
		// HITO 3.2: en pantallas bajas se encoge la entrada para que quepan
		// cabecera + chat + entrada + hints + estado. M2: con panel, el chat
		// es más estrecho (relayout).
		m.relayout()
		return m, nil

	case evMsg:
		m.onEvent(msg.ev)
		return m, nil

	case pendingTimeoutMsg:
		return m.panelTimeout(msg.gen)

	case evErr:
	if m.turnID == "" && !m.thinking {		m.fatal = T(m.lang, "err_motor") + msg.err.Error()
		return m, tea.Quit
	}
		m.addLine(T(m.lang, "err_motor") + msg.err.Error())
		m.thinking = false
		m.turnID = ""
		m.setStatus()
		return m, nil

	case tea.MouseMsg:
		// M2.5: rueda = desplaza chat; clic = sesiones/botones. Sin ratón se ignora.
		if m.mouseOn {
			return m.handleMouse(msg)
		}
		return m, nil

	case tea.KeyMsg:
		// Tanto Enter clásico como CR/LF como runas abren/ejecutan (algunas
		// terminales decodifican \r de forma no determinista).
		if msg.Type == tea.KeyRunes && (string(msg.Runes) == "\r" || string(msg.Runes) == "\n") {
			return m.doEnter()
		}
		// M2.2: foco del panel (teclas, filtro, renombrado).
		if um, cmd, done := m.handlePanelKey(msg); done {
			return um, cmd
		}
		// HITO 3.5: historial con ↑↓ cuando la entrada es de una línea.
		if (msg.Type == tea.KeyUp || msg.Type == tea.KeyDown) && m.confirm == nil &&
			!strings.Contains(m.input.Value(), "\n") && len(m.history) > 0 {
			if msg.Type == tea.KeyUp {
				if m.histIdx == -1 {
					m.histIdx = len(m.history) - 1
				} else if m.histIdx > 0 {
					m.histIdx--
				}
			} else {
				if m.histIdx == -1 {
					return m, nil
				}
				if m.histIdx < len(m.history)-1 {
					m.histIdx++
				} else {
					m.histIdx = -1
					m.input.Reset()
					return m, nil
				}
			}
			if m.histIdx != -1 {
				m.input.SetValue(m.history[m.histIdx])
			}
			return m, nil
		}
		if m.confirm != nil {
			switch msg.String() {
			case "y", "Y", "s", "S", "enter":
				c := m.confirm
				m.confirm = nil
				if c.kind == "delsess" {
					if err := m.client.DeleteSession(c.sessID); err != nil {
						m.addLine(T(m.lang, "err_sessions") + err.Error())
					} else {
						m.addLine(F(m.lang, "confirm_result", map[string]string{"reason": c.detail}))
						if c.sessID == m.sessionID {
							m.sessionID = ""
							m.sessName = ""
							m.messages = nil
							m.viewport.SetContent("")
							m.setStatus()
						}
						m.refreshPanel()
					}
					return m, nil
				}
				m.addLine(F(m.lang, "confirm_yes", map[string]string{"detail": c.detail}))
				go func() {
					_ = m.client.Confirm(c.id, true)
				}()
				return m, nil
			case "n", "N", "esc":
				c := m.confirm
				m.confirm = nil
				m.addLine(T(m.lang, "confirm_no"))
				go func() {
					_ = m.client.Confirm(c.id, false)
				}()
				return m, nil
			}
			return m, nil
		}
		switch msg.Type {
		case tea.KeyCtrlC:
			if m.turnID != "" {
				id := m.turnID
				m.addLine(T(m.lang, "cancel_line"))
				go func() {
					_ = m.client.Cancel(id)
				}()
				return m, nil
			}
			return m, tea.Quit
		case tea.KeyTab:
			// M1.3: Tab completa /comandos; si no hay comando, cambia el foco.
			// (Descarta tecla pendiente: cambiar de contexto cancela la espera.)
			m.panel.pending = 0
			m.panel.pendingGen++
			if m.confirm == nil && m.turnID == "" {
				if strings.HasPrefix(m.input.Value(), "/") {
					if done := completeSlash(m.input.Value()); done != m.input.Value() {
						m.input.SetValue(done)
					}
				} else if m.panel.Open {
					m.panel.Focus = !m.panel.Focus
					if !m.panel.Focus {
						m.panel.Filter = ""
					}
				}
			}
			return m, nil
		case tea.KeyCtrlB:
			// M2.1: pliega/despliega el panel (visible en hints).
			m.panel.pending = 0
			m.panel.pendingGen++
			m.panel.Open = !m.panel.Open
			if !m.panel.Open {
				m.panel.Focus = false
			} else {
				m.refreshPanel()
			}
			m.client.SetUi(m.panel.Open, m.sessionID)
			m.relayout()
			m.setStatus()
			return m, nil
		case tea.KeyEsc:
			if m.panel.Focus {
				m.panel.Focus = false
				m.panel.Filter = ""
				m.panel.pending = 0
				m.panel.pendingGen++
				return m, nil
			}
			// Esc fuera del panel: cae al input (comportamiento actual).
			return m, nil
		case tea.KeyEnter:
			return m.doEnter()
		}
	}

	var cmd tea.Cmd
	m.input, cmd = m.input.Update(msg)
	if _, ok := msg.(tea.WindowSizeMsg); !ok {
		var vcmd tea.Cmd
		m.viewport, vcmd = m.viewport.Update(msg)
		_ = vcmd
	}
	return m, cmd
}

// doEnter ejecuta Intro venga como venga (KeyEnter o runas CR/LF).
func (m *Model) doEnter() (tea.Model, tea.Cmd) {
	// M2.2: Enter con panel enfocado abre/renombra, no lanza turno.
	if m.panel.Focus && m.turnID == "" {
		return m.panelEnter()
	}
	text := strings.TrimSpace(m.input.Value())
	if text == "" || m.turnID != "" {
		return m, nil
	}
	m.input.Reset()
	m.history = append(m.history, text)
	if len(m.history) > 200 {
		m.history = m.history[len(m.history)-200:]
	}
	m.histIdx = -1
	if m.handleCommand(text) {
		if text == "/quit" {
			return m, tea.Quit
		}
		return m, nil
	}
	m.addLine("> " + text)
	m.thinking = true
	m.setStatus()
	go m.sendTurn(text)
	return m, nil
}

// slashCmds son los comandos con / (M1.3: nombres fijos en inglés).
var slashCmds = []string{"/help", "/sessions", "/resume", "/new", "/plan", "/build", "/model", "/lang", "/title", "/learn", "/mouse", "/copy", "/mcp", "/parallel", "/quit"}

// completeSlash completa con Tab el comando empezado (prefijo único o común).
func completeSlash(input string) string {
	if !strings.HasPrefix(input, "/") || strings.Contains(input, " ") {
		return input
	}
	var hits []string
	for _, c := range slashCmds {
		if strings.HasPrefix(c, input) {
			hits = append(hits, c)
		}
	}
	if len(hits) == 0 {
		return input
	}
	if len(hits) == 1 {
		return hits[0] + " "
	}
	pre := hits[0]
	for _, h := range hits[1:] {
		for !strings.HasPrefix(h, pre) {
			pre = pre[:len(pre)-1]
		}
	}
	return pre
}

// handleLang lista/fija idioma UI y modo de respuesta (M1.5, efecto inmediato).
func (m *Model) handleLang(parts []string) bool {
	if len(parts) == 1 {
		ui, answer, langs, err := m.client.Langs()
		if err != nil {
			m.addLine(T(m.lang, "err_model") + err.Error())
			return true
		}
		for i, l := range langs {
			mark := " "
			if l.Code == ui {
				mark = "*"
			}
			m.addLine(mark + " " + fmt.Sprint(i+1) + " " + l.Native + " (" + l.Code + ")")
		}
		m.addLine(F(m.lang, "lang_current", map[string]string{"lang": ui, "answer": answer}))
		return true
	}
	if parts[1] == "answer" && len(parts) > 2 {
		msg, err := m.client.SetAnswer(parts[2])
		if err != nil {
			m.addLine(T(m.lang, "err_model") + err.Error())
			return true
		}
		m.addLine(msg)
		return true
	}
	target := parts[1]
	if idx, err := strconv.Atoi(target); err == nil {
		if _, _, langs, lerr := m.client.Langs(); lerr == nil && idx >= 1 && idx <= len(langs) {
			target = langs[idx-1].Code
		}
	}
	lang, msg, err := m.client.SetLang(target)
	if err != nil {
		m.addLine(T(m.lang, "err_model") + err.Error())
		return true
	}
	if lang == "" {
		m.addLine(T(m.lang, "lang_usage"))
		return true
	}
	cat, err := m.client.I18n(lang)
	if err != nil {
		m.addLine(T(m.lang, "err_model") + err.Error())
		return true
	}
	SetCatalog(cat)
	m.lang = lang
	if msg != "" {
		m.addLine(msg)
	} else {
		m.addLine(F(m.lang, "lang_auto", map[string]string{}))
	}
	m.setStatus()
	return true
}
func (m *Model) handleCommand(text string) bool {
	if !strings.HasPrefix(text, "/") {
		return false
	}
	parts := strings.Fields(text)
	switch parts[0] {
	case "/help":
		// M3.4: ayuda formateada con secciones.
		m.addLine("")
		m.addLine(lipgloss.NewStyle().Foreground(gold).Bold(true).Render("  NOIRACODER — " + T(m.lang, "help_title")))
		m.addLine("")
		m.addLine(lipgloss.NewStyle().Foreground(magenta).Bold(true).Render("  " + T(m.lang, "help_section_cmds")))
		m.addLine("  " + T(m.lang, "help_cmds"))
		m.addLine("")
		m.addLine(lipgloss.NewStyle().Foreground(magenta).Bold(true).Render("  " + T(m.lang, "help_section_keys")))
		m.addLine("  " + T(m.lang, "help_keys"))
		m.addLine("")
		m.addLine(lipgloss.NewStyle().Foreground(muted).Render("  " + T(m.lang, "help_footer")))
		m.addLine("")
		return true
	case "/sessions":
		filter := ""
		if len(parts) > 1 {
			filter = strings.ToLower(strings.Join(parts[1:], " "))
		}
		list, err := m.client.Sessions()
		if err != nil {
			m.addLine(T(m.lang, "err_sessions") + err.Error())
			return true
		}
		if len(list) == 0 {
			m.addLine(T(m.lang, "no_sessions"))
			return true
		}
		for i, s := range list {
			if filter != "" && !strings.Contains(strings.ToLower(s.Nombre), filter) &&
				!strings.Contains(strings.ToLower(s.ID), filter) {
				continue
			}
			mark := " "
			if s.ID == m.sessionID {
				mark = "*"
			}
			m.addLine(FP(m.lang, "session_row", s.Turnos, map[string]string{
			"mark": mark, "n": fmt.Sprint(i + 1), "name": s.Nombre,
			"turns": fmt.Sprint(s.Turnos), "rel": or(s.Rel, "—"),
		}))
		}
		m.addLine(T(m.lang, "resume_hint"))
		return true
	case "/resume":
		if len(parts) < 2 {
			m.addLine(T(m.lang, "resume_usage"))
			return true
		}
		list, err := m.client.Sessions()
		if err != nil {
			m.addLine(T(m.lang, "err_sessions") + err.Error())
			return true
		}
		target := parts[1]
		for i, s := range list {
			if fmt.Sprint(i+1) == target || s.ID == target || strings.HasPrefix(s.ID, target) {
				target = s.ID
				break
			}
		}
		turns, name, err := m.client.History(target)
		if err != nil {
			m.addLine(T(m.lang, "err_resume") + err.Error())
			return true
		}
		m.sessionID = target
		m.sessName = name
		m.messages = nil
		for _, t := range turns {
			if t.Role == "user" {
				m.addLine("> " + t.Content)
			} else {
				m.addLine(t.Content)
			}
		}
		m.addLine(FP(m.lang, "resumed", len(turns)/2, map[string]string{
		"name": name, "turns": fmt.Sprint(len(turns) / 2),
	}))
		m.setStatus()
		return true
	case "/new":
		m.sessionID = ""
		m.sessName = ""
		m.messages = nil
		m.viewport.SetContent("")
		m.addLine(T(m.lang, "new_session"))
		m.setStatus()
		return true
	case "/plan":
		m.mode = "plan"
		m.addLine(T(m.lang, "plan_on"))
		m.setStatus()
		return true
	case "/build":
		m.mode = "build"
		m.addLine(T(m.lang, "build_on"))
		m.setStatus()
		return true
	case "/quit":
		return true
	case "/mouse":
		if len(parts) < 2 || (parts[1] != "on" && parts[1] != "off") {
			m.addLine(T(m.lang, "mouse_usage"))
			return true
		}
		m.mouseOn = parts[1] == "on"
		saveMousePref(m.mouseOn)
		zone.SetEnabled(m.mouseOn)
		if m.program != nil {
			if m.mouseOn {
				m.program.Send(tea.EnableMouseCellMotion())
			} else {
				m.program.Send(tea.DisableMouse())
			}
		}
		return true
	case "/copy":
		// M2.5: copia la última respuesta (portapapeles o aviso).
		last := ""
		for i := len(m.messages) - 1; i >= 0; i-- {
			if !strings.HasPrefix(m.messages[i], "> ") && strings.TrimSpace(m.messages[i]) != "" {
				last = m.messages[i]
				break
			}
		}
		if last == "" {
			return true
		}
		if err := clipboard.WriteAll(last); err != nil {
			m.addLine(T(m.lang, "err_line") + err.Error())
			return true
		}
		m.addLine(F(m.lang, "copy_ok", map[string]string{"n": fmt.Sprint(len([]rune(last)))}))
		return true
	case "/lang":
		return m.handleLang(parts)
	case "/title":
		if len(parts) < 2 {
			m.addLine(T(m.lang, "title_usage"))
			return true
		}
		msg, err := m.client.SetTitle(parts[1])
		if err != nil {
			m.addLine(T(m.lang, "err_model") + err.Error())
			return true
		}
		m.addLine(msg)
		return true
	case "/learn":
		if len(parts) >= 3 && parts[1] == "revert" {
			msg, err := m.client.RevertLearn(parts[2])
			if err != nil {
				m.addLine(T(m.lang, "err_model") + err.Error())
				return true
			}
			m.addLine(msg)
			return true
		}
		if len(parts) == 2 && parts[1] != "revert" {
			m.addLine(T(m.lang, "learn_usage"))
			return true
		}
		out, err := m.client.Learn()
		if err != nil {
			m.addLine(T(m.lang, "err_model") + err.Error())
			return true
		}
		for _, ln := range strings.Split(out, "\n") {
			m.addLine(ln)
		}
		return true
	case "/mcp":
		// M5.1: listar servidores MCP conectados y sus tools.
		servers, err := m.client.McpServers()
		if err != nil {
			m.addLine(T(m.lang, "err_model") + err.Error())
			return true
		}
		if len(servers) == 0 {
			m.addLine(T(m.lang, "mcp_no_servers"))
			return true
		}
		m.addLine(lipgloss.NewStyle().Foreground(magenta).Bold(true).Render("  MCP Servers"))
		m.addLine("")
		for _, s := range servers {
			m.addLine("  " + lipgloss.NewStyle().Foreground(gold).Render(s.Name) +
				lipgloss.NewStyle().Foreground(muted).Render(fmt.Sprintf(" (%d tools)", len(s.Tools))))
			for _, t := range s.Tools {
				m.addLine("    " + lipgloss.NewStyle().Foreground(muted).Render("· "+t))
			}
		}
		m.addLine("")
		return true
	case "/parallel":
		// M5.2: toggle modo paralelo (checks de hoja en paralelo).
		on, err := m.client.ParallelToggle()
		if err != nil {
			m.addLine(T(m.lang, "err_model") + err.Error())
			return true
		}
		if on {
			m.addLine(T(m.lang, "parallel_on"))
		} else {
			m.addLine(T(m.lang, "parallel_off"))
		}
		return true
	case "/model":
		if len(parts) < 2 {
			m.addLine(F(m.lang, "model_usage", map[string]string{"model": m.modelName}))
			return true
		}
		if parts[1] == "stats" {
			stats, err := m.client.ModelStats()
			if err != nil {
				m.addLine(T(m.lang, "err_model") + err.Error())
				return true
			}
			if len(stats) == 0 {
				m.addLine(T(m.lang, "model_stats_empty"))
				return true
			}
			m.addLine(T(m.lang, "model_stats_header"))
			for id, s := range stats {
				lat := "—"
				if s.AvgLatencyMs != nil {
					lat = fmt.Sprintf("%.0fms", *s.AvgLatencyMs)
				}
				m.addLine(fmt.Sprintf("  %s  lat=%s  score=%.0f", id, lat, s.Score))
			}
			return true
		}
		if err := m.client.SetModel(parts[1]); err != nil {
			m.addLine(T(m.lang, "err_model") + err.Error())
			return true
		}
		m.modelName = Sanitize(parts[1])
		m.addLine(F(m.lang, "model_set", map[string]string{"model": m.modelName}))
		m.setStatus()
		return true
	}
	m.addLine(T(m.lang, "unknown_cmd"))
	return true
}

func (m *Model) sendTurn(text string) {	turnID, sessID, err := m.client.Turn(m.sessionID, text, m.mode)
	if err != nil || m.program == nil {
		if m.program != nil {
			m.program.Send(evErr{fmt.Errorf("%s%s", T(m.lang, "err_line"), err)})
		}
		return
	}
	m.sessionID = sessID
	m.turnID = turnID
}

func str(ev Event, k string) string {
	if v, ok := ev.Data[k]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func (m *Model) onEvent(ev Event) {
	switch ev.Name {
	case "hello":
		// M3.2: boot message con marca y atajos.
		m.addLine("")
		m.addLine(lipgloss.NewStyle().Foreground(gold).Bold(true).Render("  > NOIRACODER") +
			lipgloss.NewStyle().Foreground(muted).Render("  "+T(m.lang, "connected")))
		m.addLine(lipgloss.NewStyle().Foreground(muted).Render("  "+T(m.lang, "boot_hint")))
		m.addLine("")
		// M2.7: restaura panel + sesión recordada.
		open, sid := m.client.GetUi()
		m.panel.Open = open
		m.relayout()
		m.refreshPanel()
		if sid != "" {
			for _, it := range m.panel.Items {
				if it.ID == sid {
					m.openSession(sid)
					break
				}
			}
		}
		m.setStatus()
	case "turn.echo":
		// M4.2: eco inmediato del mensaje del usuario.
		if msg := str(ev, "message"); msg != "" {
			m.messages = append(m.messages, "> "+Sanitize(msg))
			m.viewport.SetContent(strings.Join(m.messages, "\n"))
			m.viewport.GotoBottom()
		}
	case "turn.thinking":
		// M4.2: indicador de que el modelo está procesando.
		m.addLine(T(m.lang, "turn_thinking"))
	case "turn.silence":
		// M4.2: aviso de silencio prolongado.
		m.addLine(F(m.lang, "turn_silence", map[string]string{
			"hint": str(ev, "hint"), "ms": fmt.Sprintf("%v", ev.Data["ms"]),
		}))
	case "turn.text":
		if d, ok := ev.Data["delta"].(string); ok && len(m.messages) > 0 {
			last := len(m.messages) - 1
			if strings.HasPrefix(m.messages[last], "> ") {
				m.messages = append(m.messages, "")
				last++
			}
			m.messages[last] += Sanitize(d)
			m.viewport.SetContent(strings.Join(m.messages, "\n"))
			m.viewport.GotoBottom()
		}
	case "model.switch":
		m.modelName = Sanitize(or(str(ev, "a"), m.modelName))
		m.addLine(F(m.lang, "model_switched", map[string]string{
			"from": str(ev, "de"), "to": str(ev, "a"), "reason": str(ev, "motivo"),
		}))
		m.setStatus()
	case "confirm.request":
		m.confirm = &confirmState{id: str(ev, "confirmId"), detail: str(ev, "detalle")}
	case "model.quota":
		if v, ok := ev.Data["usadoPct"].(float64); ok {
			m.quotaPct = int(v)
		}
		if a := str(ev, "aviso"); a != "" {
			m.addLine(F(m.lang, "quota_warn", map[string]string{"notice": a}))
		}
		m.setStatus()
	case "confirm.result":
		m.addLine(F(m.lang, "confirm_result", map[string]string{"reason": str(ev, "motivo")}))
	case "memory.event":
		m.addLine(F(m.lang, "mem_line", map[string]string{"level": str(ev, "nivel"), "summary": str(ev, "resumen")}))
	case "turn.tool_start":
		m.addLine(F(m.lang, "tool_start", map[string]string{"name": str(ev, "nombre"), "detail": str(ev, "detalle")}))
	case "turn.tool_end":
		code := ""
		if v, ok := ev.Data["exitCode"]; ok && v == float64(1) {
			code = T(m.lang, "tool_end_fail")
		}
		m.addLine(F(m.lang, "tool_end", map[string]string{"name": str(ev, "nombre"), "result": code}))
	case "session.updated":
		if n := str(ev, "nombre"); n != "" {
			m.sessName = Sanitize(n)
		}
		m.setStatus()
		m.refreshPanel()
	case "turn.error":
		m.addLine(T(m.lang, "err_line") + str(ev, "mensaje"))
		m.thinking = false
		m.turnID = ""
		m.setStatus()
	case "turn.end":
		m.thinking = false
		m.turnID = ""
		m.setStatus()
		m.refreshPanel()
	}
}

func (m *Model) View() string {
	if m.fatal != "" {
		return lipgloss.NewStyle().Foreground(red).Render("NOIRACODER: "+m.fatal+"\n") +
			T(m.lang, "fatal_line") + "\n"
	}
	// M3.1: header con marca dorada + modelo en magenta si es manual.
	modelLabel := m.modelName
	if m.modelName != "(router)" {
		modelLabel = lipgloss.NewStyle().Foreground(magenta).Bold(true).Render(m.modelName)
	} else {
		modelLabel = lipgloss.NewStyle().Foreground(muted).Render(m.modelName)
	}
	// M3.6: modo con color distintivo.
	modeLabel := m.mode
	switch m.mode {
	case "build":
		modeLabel = lipgloss.NewStyle().Foreground(green).Render("build")
	case "plan":
		modeLabel = lipgloss.NewStyle().Foreground(yellow).Render("plan")
	}
	head := lipgloss.NewStyle().Foreground(gold).Bold(true).Render("> NOIRACODER") +
		"  " + modelLabel + lipgloss.NewStyle().Foreground(muted).Render(" · ") + modeLabel
	body := m.viewport.View()
	var dlg string
	if m.confirm != nil {
		box := lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(yellow).Padding(0, 1)
		dlg = "\n" + box.Render(T(m.lang, "confirm_q")+"\n"+m.confirm.detail+"\n\n"+T(m.lang, "confirm_yn")) + "\n"
	}
	box := lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(border).Padding(0, 1)
	in := box.Render(m.input.View())
	hints := lipgloss.NewStyle().Foreground(muted).Render(T(m.lang, "hints"))
	extra := ""
	if m.mouseOn {
		extra = "\n" + lipgloss.NewStyle().Foreground(muted).Render(
			runewidth.Truncate(T(m.lang, "mouse_hint"), m.chatW, ""))
	}
	st := lipgloss.NewStyle().Foreground(muted).Render(m.status)
	chat := head + "\n" + body + dlg + "\n" + in + "\n" + hints + extra + "\n" + st
	// M2: lateral al lado (ancho) o como hoja (estrecho). Scan envuelve
	// las zonas de clic para el ratón.
	if m.panel.Open && m.width >= MinFullWidth {
		return zone.Scan(lipgloss.JoinHorizontal(lipgloss.Top, m.renderPanel(), chat))
	}
	if m.panel.Open {
		// Hoja en ventana estrecha: cabecera + panel (salida con Esc/Ctrl+B).
		head := lipgloss.NewStyle().Foreground(gold).Bold(true).Render("> NOIRACODER") +
			"  " + lipgloss.NewStyle().Foreground(muted).Render(T(m.lang, "panel_hint_esc"))
		return zone.Scan(head + "\n" + m.renderPanel())
	}
	return zone.Scan(chat)
}

// relayout ajusta viewport/entrada al ancho del chat (con o sin panel).
func (m *Model) relayout() {
	chatW := m.width
	if m.panel.Open && m.width >= MinFullWidth {
		chatW = m.width - PanelWidth - 1
	}
	if chatW < 20 {
		chatW = 20
	}
	m.chatW = chatW
	m.viewport.Width = chatW - 4
	if m.viewport.Width < 10 {
		m.viewport.Width = 10
	}
	ih := 3
	if m.height < 18 {
		ih = 1
	}
	m.input.SetHeight(ih)
	extra := 1 // línea mouse_hint cuando el ratón está activo
	if !m.mouseOn {
		extra = 0
	}
	m.viewport.Height = m.height - (1 + ih + 2 + 1 + 1) - 1 - extra
	if m.viewport.Height < 3 {
		m.viewport.Height = 3
	}
	m.input.SetWidth(chatW - 6)
	if m.input.Width() < 10 {
		m.input.SetWidth(10)
	}
}
