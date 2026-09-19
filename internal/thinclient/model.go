// UI del cliente fino (Hito 1): pantalla completa, chat + entrada + estado.
// Sin i18n aún (Hito 3.6): español por defecto.
package thinclient

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/textarea"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

type evMsg struct{ ev Event }
type evErr struct{ err error }

type confirmState struct {
	id     string
	detail string
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
	program   *tea.Program
}

var (
	gold   = lipgloss.Color("#FBBF24")
	green  = lipgloss.Color("#22c55e")
	red    = lipgloss.Color("#ef4444")
	yellow = lipgloss.Color("#eab308")
	muted  = lipgloss.Color("#666666")
	border = lipgloss.Color("#222222")
)

// New crea el modelo y arranca el stream de eventos.
func New(c *Client) *Model {
	lang := detectLang()
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
	parts := []string{
		T(m.lang, "st_model") + ": " + m.modelName,
		T(m.lang, "st_mode") + ": " + m.mode,
		T(m.lang, "st_session") + ": " + or(m.sessName, "—"),
	}
	if m.quotaPct > 0 {
		parts = append(parts, fmt.Sprintf(T(m.lang, "st_quota"), m.quotaPct))
	}
	if m.thinking {
		parts = append(parts, fmt.Sprintf(T(m.lang, "st_thinking"), m.modelName))
	}
	if m.turnID != "" {
		parts = append(parts, T(m.lang, "st_turn"))
	}
	m.status = strings.Join(parts, " · ")
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
		m.viewport.Width = msg.Width - 4
		// HITO 3.2: en pantallas bajas se encoge la entrada para que quepan
		// cabecera + chat + entrada + hints + estado.
		ih := 3
		if msg.Height < 18 {
			ih = 1
		}
		m.input.SetHeight(ih)
		m.viewport.Height = msg.Height - (1 + ih + 2 + 1 + 1) - 1
		if m.viewport.Height < 3 {
			m.viewport.Height = 3
		}
		m.input.SetWidth(msg.Width - 6)
		return m, nil

	case evMsg:
		m.onEvent(msg.ev)
		return m, nil

	case evErr:
		if m.turnID == "" && !m.thinking {
			m.fatal = "motor: " + msg.err.Error()
			return m, tea.Quit
		}
		m.addLine(T(m.lang, "err_motor") + msg.err.Error())
		m.thinking = false
		m.turnID = ""
		m.setStatus()
		return m, nil

	case tea.KeyMsg:
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
				m.addLine(fmt.Sprintf(T(m.lang, "confirm_yes"), c.detail))
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
		case tea.KeyEnter:
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

// handleCommand ejecuta comandos con / (Hito 2.3). Devuelve true si era comando.
func (m *Model) handleCommand(text string) bool {
	if !strings.HasPrefix(text, "/") {
		return false
	}
	parts := strings.Fields(text)
	switch parts[0] {
	case "/help":
		m.addLine(T(m.lang, "help_cmds"))
		m.addLine(T(m.lang, "help_keys"))
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
			m.addLine(fmt.Sprintf("%s%d · %s (%d turnos)", mark, i+1, s.Nombre, s.Turnos))
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
		m.addLine(fmt.Sprintf(T(m.lang, "resumed"), name, len(turns)/2))
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
	case "/model":
		if len(parts) < 2 {
			m.addLine(fmt.Sprintf(T(m.lang, "model_usage"), m.modelName))
			return true
		}
		if err := m.client.SetModel(parts[1]); err != nil {
			m.addLine(T(m.lang, "err_model") + err.Error())
			return true
		}
		m.modelName = Sanitize(parts[1])
		m.addLine(fmt.Sprintf(T(m.lang, "model_set"), m.modelName))
		m.setStatus()
		return true
	}
	m.addLine(T(m.lang, "unknown_cmd"))
	return true
}

func (m *Model) sendTurn(text string) {	turnID, sessID, err := m.client.Turn(m.sessionID, text, m.mode)
	if err != nil || m.program == nil {
		if m.program != nil {
			m.program.Send(evErr{fmt.Errorf("%sturno: %v", T(m.lang, "err_line"), err)})
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
		m.addLine(T(m.lang, "connected"))
		m.setStatus()
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
		m.addLine(fmt.Sprintf(T(m.lang, "model_switched"), str(ev, "de"), str(ev, "a"), str(ev, "motivo")))
		m.setStatus()
	case "confirm.request":
		m.confirm = &confirmState{id: str(ev, "confirmId"), detail: str(ev, "detalle")}
	case "model.quota":
		if v, ok := ev.Data["usadoPct"].(float64); ok {
			m.quotaPct = int(v)
		}
		if a := str(ev, "aviso"); a != "" {
			m.addLine(fmt.Sprintf(T(m.lang, "quota_warn"), a))
		}
		m.setStatus()
	case "confirm.result":
		m.addLine(fmt.Sprintf("[confirm] %s", str(ev, "motivo")))
	case "memory.event":
		m.addLine(fmt.Sprintf(T(m.lang, "mem_line"), str(ev, "nivel"), str(ev, "resumen")))
	case "turn.tool_start":
		m.addLine(fmt.Sprintf(T(m.lang, "tool_start"), str(ev, "nombre"), str(ev, "detalle")))
	case "turn.tool_end":
		code := ""
		if v, ok := ev.Data["exitCode"]; ok && v == float64(1) {
			code = T(m.lang, "tool_end_fail")
		}
		m.addLine(fmt.Sprintf(T(m.lang, "tool_end"), str(ev, "nombre"), code))
	case "session.updated":
		if n := str(ev, "nombre"); n != "" {
			m.sessName = Sanitize(n)
		}
		m.setStatus()
	case "turn.error":
		m.addLine(T(m.lang, "err_line") + str(ev, "mensaje"))
		m.thinking = false
		m.turnID = ""
		m.setStatus()
	case "turn.end":
		m.thinking = false
		m.turnID = ""
		m.setStatus()
	}
}

func (m *Model) View() string {
	if m.fatal != "" {
		return lipgloss.NewStyle().Foreground(red).Render("NOIRACODER: "+m.fatal+"\n") +
			T(m.lang, "fatal_line") + "\n"
	}
	head := lipgloss.NewStyle().Foreground(gold).Bold(true).Render("> NOIRACODER") +
		"  " + lipgloss.NewStyle().Foreground(muted).Render(m.modelName+" · "+m.mode)
	body := m.viewport.View()
	var dlg string
	if m.confirm != nil {
		box := lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(yellow).Padding(0, 1)
		dlg = "\n" + box.Render(T(m.lang, "confirm_q")+"\n"+m.confirm.detail+"\n\n"+T(m.lang, "confirm_yn")) + "\n"
	}
	box := lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(border).Padding(0, 1)
	in := box.Render(m.input.View())
	hints := lipgloss.NewStyle().Foreground(muted).Render(T(m.lang, "hints"))
	st := lipgloss.NewStyle().Foreground(muted).Render(m.status)
	return head + "\n" + body + dlg + "\n" + in + "\n" + hints + "\n" + st
}
