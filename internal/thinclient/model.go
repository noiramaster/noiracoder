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
	ta := textarea.New()
	ta.Placeholder = "> escribe tu tarea… (Enter envía, Ctrl+C cancela/sale)"
	ta.Focus()
	ta.SetHeight(3)
	vp := viewport.New(80, 20)
	m := &Model{
		client:    c,
		viewport:  vp,
		input:     ta,
		modelName: "(router)",
		mode:      "build",
		status:    "conectando…",
	}
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
		"modelo: " + m.modelName,
		"modo: " + m.mode,
		"sesión: " + or(m.sessName, "—"),
	}
	if m.quotaPct > 0 {
		parts = append(parts, fmt.Sprintf("cuota: %d%%", m.quotaPct))
	}
	if m.thinking {
		parts = append(parts, "pensando… ("+m.modelName+")")
	}
	if m.turnID != "" {
		parts = append(parts, "turno en curso (Ctrl+C cancela)")
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
		m.viewport.Height = msg.Height - 12
		if m.viewport.Height < 5 {
			m.viewport.Height = 5
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
		m.addLine("[error motor] " + msg.err.Error())
		m.thinking = false
		m.turnID = ""
		m.setStatus()
		return m, nil

	case tea.KeyMsg:
		if m.confirm != nil {
			switch msg.String() {
			case "y", "Y", "s", "S", "enter":
				c := m.confirm
				m.confirm = nil
				m.addLine("[confirm] permitido por el usuario: " + c.detail)
				go func() {
					_ = m.client.Confirm(c.id, true)
				}()
				return m, nil
			case "n", "N", "esc":
				c := m.confirm
				m.confirm = nil
				m.addLine("[confirm] denegado por el usuario.")
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
				m.addLine("[cancel] cancelando turno…")
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
		m.addLine("Comandos: /sessions [filtro] · /resume <n|id> · /new · /plan · /build · /model <id> · /quit")
		return true
	case "/sessions":
		filter := ""
		if len(parts) > 1 {
			filter = strings.ToLower(strings.Join(parts[1:], " "))
		}
		list, err := m.client.Sessions()
		if err != nil {
			m.addLine("[error] sesiones: " + err.Error())
			return true
		}
		if len(list) == 0 {
			m.addLine("(sin sesiones guardadas)")
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
		m.addLine("usa /resume <n> para continuar una sesión")
		return true
	case "/resume":
		if len(parts) < 2 {
			m.addLine("uso: /resume <n|id>  (mira /sessions)")
			return true
		}
		list, err := m.client.Sessions()
		if err != nil {
			m.addLine("[error] sesiones: " + err.Error())
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
			m.addLine("[error] reanudar: " + err.Error())
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
		m.addLine(fmt.Sprintf("(sesión reanudada: %s, %d turnos)", name, len(turns)/2))
		m.setStatus()
		return true
	case "/new":
		m.sessionID = ""
		m.sessName = ""
		m.messages = nil
		m.viewport.SetContent("")
		m.addLine("(nueva sesión)")
		m.setStatus()
		return true
	case "/plan":
		m.mode = "plan"
		m.addLine("(modo Plan: solo lectura, todo se deniega)")
		m.setStatus()
		return true
	case "/build":
		m.mode = "build"
		m.addLine("(modo Build: ejecución con confirmaciones)")
		m.setStatus()
		return true
	case "/quit":
		return true
	case "/model":
		if len(parts) < 2 {
			m.addLine("uso: /model <id>  (modelo actual: " + m.modelName + ")")
			return true
		}
		if err := m.client.SetModel(parts[1]); err != nil {
			m.addLine("[error] modelo: " + err.Error())
			return true
		}
		m.modelName = Sanitize(parts[1])
		m.addLine("(modelo preferido: " + m.modelName + ")")
		m.setStatus()
		return true
	}
	m.addLine("(comando desconocido, prueba /help)")
	return true
}

func (m *Model) sendTurn(text string) {	turnID, sessID, err := m.client.Turn(m.sessionID, text, m.mode)
	if err != nil || m.program == nil {
		if m.program != nil {
			m.program.Send(evErr{fmt.Errorf("turno: %v", err)})
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
		m.addLine("> NOIRACODER conectado al motor.")
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
		m.addLine(fmt.Sprintf("[modelo] %s → %s (%s)", str(ev, "de"), str(ev, "a"), str(ev, "motivo")))
		m.setStatus()
	case "confirm.request":
		m.confirm = &confirmState{id: str(ev, "confirmId"), detail: str(ev, "detalle")}
	case "model.quota":
		if v, ok := ev.Data["usadoPct"].(float64); ok {
			m.quotaPct = int(v)
		}
		if a := str(ev, "aviso"); a != "" {
			m.addLine("[cuota] " + a)
		}
		m.setStatus()
	case "confirm.result":
		m.addLine(fmt.Sprintf("[confirm] %s", str(ev, "motivo")))
	case "memory.event":
		m.addLine(fmt.Sprintf("[memoria:%s] %s", str(ev, "nivel"), str(ev, "resumen")))
	case "turn.tool_start":
		m.addLine(fmt.Sprintf("[tool] %s %s", str(ev, "nombre"), str(ev, "detalle")))
	case "turn.tool_end":
		code := ""
		if v, ok := ev.Data["exitCode"]; ok && v == float64(1) {
			code = " (falló)"
		}
		m.addLine(fmt.Sprintf("[tool] %s fin%s", str(ev, "nombre"), code))
	case "session.updated":
		if n := str(ev, "nombre"); n != "" {
			m.sessName = Sanitize(n)
		}
		m.setStatus()
	case "turn.error":
		m.addLine("[error] " + str(ev, "mensaje"))
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
			"Revisa que el motor siga vivo. Pulsa cualquier tecla.\n"
	}
	head := lipgloss.NewStyle().Foreground(gold).Bold(true).Render("> NOIRACODER") +
		"  " + lipgloss.NewStyle().Foreground(muted).Render(m.modelName+" · "+m.mode)
	body := m.viewport.View()
	var dlg string
	if m.confirm != nil {
		box := lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(yellow).Padding(0, 1)
		dlg = "\n" + box.Render("¿Permites esto?\n"+m.confirm.detail+"\n\n[y] sí   [n] no") + "\n"
	}
	box := lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(border).Padding(0, 1)
	in := box.Render(m.input.View())
	st := lipgloss.NewStyle().Foreground(muted).Render(m.status)
	return head + "\n" + body + dlg + "\n" + in + "\n" + st
}
