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

// H10: opciones seleccionables
type optionItem struct {
	Key         string
	Label       string
	Recommended bool
}

type optionsState struct {
	id     string
	prompt string
	items  []optionItem
	idx    int // cursor para flechas
}

// H8: connect state — waiting for API key input after provider selection
type connectState struct {
	serviceID string
	serviceName string
	keyURL    string
}

type Model struct {
	client      *Client
	lang        string
	viewport    viewport.Model
	input       textarea.Model
	messages    []string
	status      string
	modelName   string
	mode        string
	quotaPct    int
	sessionID   string
	sessName    string
	turnID      string
	thinking    bool
	confirm     *confirmState
	options     *optionsState // H10
	slashOpen   bool          // M: menú de comandos "/" abierto (filtra mientras se escribe)
	slashIdx    int           // M: cursor del menú de comandos
	slashFilter string        // M: último prefijo visto (cambiarlo resetea el cursor)
	fatal       string
	history     []string
	histIdx     int
	width       int
	height      int
	chatW       int
	program     *tea.Program
	panel       Panel
	mouseOn     bool
	renaming    bool
	connectMode *connectState // H8: waiting for API key input
}

var (
	gold    = lipgloss.Color("#FBBF24")
	green   = lipgloss.Color("#22c55e")
	red     = lipgloss.Color("#ef4444")
	yellow  = lipgloss.Color("#eab308")
	accent  = lipgloss.Color("#FBBF24") // == --accent de la landing (styles.css)
	muted   = lipgloss.Color("#666666")
	border  = lipgloss.Color("#3a3a3a")
)

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

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
		modelStr = lipgloss.NewStyle().Foreground(accent).Render(m.modelName)
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

// maskKey masks an API key for display (e.g., "ghp_abc...xyz").
func maskKey(key string) string {
	if len(key) <= 8 {
		return "****"
	}
	return key[:4] + "..." + key[len(key)-4:]
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
		// M: menú de comandos "/" — mismo modelo de navegación que H10 (flechas,
		// número, clic) pero SIN tragarse la escritura: lo que no es navegación
		// cae al input y filtra la lista.
		if m.slashOpen {
			ks := msg.String()
			if ks == "up" || ks == "up.Up" || ks == "down" || ks == "down.Down" ||
				ks == "enter" || ks == "esc" {
				return m.slashKey(msg)
			}
			if len(ks) == 1 && ks[0] >= '1' && ks[0] <= '9' {
				m.slashPick(int(ks[0] - '1'))
				return m, nil
			}
			if msg.Type == tea.KeyBackspace {
				// Al borrar el "/" entero el menú se cierra; si no, se resetea
				// el cursor porque el prefijo cambió.
				if strings.TrimSpace(m.input.Value()) == "/" {
					m.slashOpen = false
				} else {
					m.slashIdx = 0
				}
			}
		}
		// HITO 3.5: historial con ↑↓ cuando la entrada es de una línea.
		// M: con el menú de "/" abierto o con opciones H10 abiertas, las flechas
		// son de SELECCIÓN, no de historial. Sin este guarda, /connect pedía
		// "flechas+Enter" en su texto pero el historial se las comía antes.
		if (msg.Type == tea.KeyUp || msg.Type == tea.KeyDown) && m.confirm == nil &&
			m.options == nil && !m.slashOpen &&
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
				// GG: /logout confirma en cliente (como borrar sesión) y el
				// servidor solo ejecuta tras el POST explícito.
				if c.kind == "logout" {
					m.addLine("")
					m.thinking = true
					m.setStatus()
					go func() {
						ok, msg := m.client.Logout()
						m.thinking = false
						if ok {
							m.addLine(lipgloss.NewStyle().Foreground(green).Render("  ✓ " + msg))
						} else {
							m.addLine(lipgloss.NewStyle().Foreground(red).Render("  ✗ " + msg))
						}
						m.setStatus()
						if m.program != nil {
							m.program.Send(tea.ClearScreen())
						}
					}()
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
		// H10: opciones seleccionables — teclado
		if m.options != nil {
			s := msg.String()
			switch {
			case s == "up", s == "up.Up":
				if m.options.idx > 0 {
					m.options.idx--
				}
				return m, nil
			case s == "down", s == "down.Down":
				if m.options.idx < len(m.options.items)-1 {
					m.options.idx++
				}
				return m, nil
			case s == "enter":
				o := m.options
				m.resolveOptionsLocal(o, o.idx, false)
				return m, nil
			case s == "esc":
				o := m.options
				m.resolveOptionsLocal(o, 0, true)
				return m, nil
			default:
				// Número directo: 1-9
				if len(s) == 1 && s[0] >= '1' && s[0] <= '9' {
					idx := int(s[0] - '1')
					if idx < len(m.options.items) {
						o := m.options
						m.resolveOptionsLocal(o, idx, false)
						return m, nil
					}
				}
				return m, nil
			}
		}
		switch msg.Type {
		case tea.KeyCtrlC:			if m.turnID != "" {
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
	m.syncSlash()
	if _, ok := msg.(tea.WindowSizeMsg); !ok {		var vcmd tea.Cmd
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

	// H8: connect mode — validate + store API key, don't create session
	if m.connectMode != nil {
		cm := m.connectMode
		m.connectMode = nil
		m.addLine("> " + maskKey(text))
		m.thinking = true
		m.setStatus()
		go func() {
			ok, errMsg := m.client.Connect(cm.serviceID, text)
			m.thinking = false
			if ok {
				m.addLine(lipgloss.NewStyle().Foreground(gold).Render("  ✓ " + cm.serviceName + " " + T(m.lang, "connect_ok")))
			} else {
				m.addLine(lipgloss.NewStyle().Foreground(red).Render("  ✗ " + T(m.lang, "connect_fail") + ": " + errMsg))
				m.addLine(lipgloss.NewStyle().Foreground(muted).Render("  " + T(m.lang, "connect_retry")))
			}
			m.setStatus()
			if m.program != nil {
				m.program.Send(tea.ClearScreen())
			}
		}()
		return m, nil
	}

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
var slashCmds = []string{"/help", "/sessions", "/resume", "/new", "/plan", "/build", "/model", "/lang", "/title", "/learn", "/mouse", "/copy", "/mcp", "/parallel", "/agents", "/connections", "/connect", "/explain", "/deploy", "/logout", "/login", "/quit"}

// slashDesc devuelve la descripción corta del comando (JJ: una por comando,
// del catálogo; si falta, solo el comando).
func (m *Model) slashDesc(c string) string {
	d := T(m.lang, "slash_desc_"+strings.TrimPrefix(c, "/"))
	if d == "" || d == "slash_desc_"+strings.TrimPrefix(c, "/") {
		return ""
	}
	return d
}

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

// resolveOptionsLocal resuelve un diálogo de opciones (Enter, número, clic
// o Esc). POST al motor solo si el diálogo es suyo (options.request);
// connect-form y welcome son locales. Usado por las 4 rutas para que se
// comporten igual.
func (m *Model) resolveOptionsLocal(o *optionsState, idx int, cancel bool) {
	m.options = nil
	if o == nil {
		return
	}
	if cancel {
		if o.id == "welcome" {
			setWelcomeSeen()
		}
		if o.id != "connect-form" && o.id != "welcome" {
			go func() {
				_ = m.client.Options(o.id, "")
			}()
		}
		return
	}
	if idx < 0 || idx >= len(o.items) {
		return
	}
	item := o.items[idx]
	if o.id != "connect-form" && o.id != "welcome" {
		go func() {
			_ = m.client.Options(o.id, item.Key)
		}()
	}
	// H8: if this is the connect form, enter connect mode
	if o.id == "connect-form" {
		m.enterConnectForm(item)
	}
	// HH: bienvenida (conectar OAuth o seguir).
	if o.id == "welcome" {
		m.chooseWelcome(item.Key)
	}
}

// enterConnectForm (H8) pide la clave tras elegir proveedor. Compartido por
// Enter, número y clic para que las tres rutas se comporten igual.
func (m *Model) enterConnectForm(item optionItem) {
	m.connectMode = &connectState{
		serviceID:   item.Key,
		serviceName: item.Label,
	}
	m.addLine("")
	m.addLine(lipgloss.NewStyle().Foreground(accent).Bold(true).Render("  " + T(m.lang, "connect_prompt_key")))
	m.addLine("")
}

// HH: bienvenida de primer arranque con el componente H10 (flechas,
// número, clic). El bloque visual va en View() como contenido ESTÁTICO
// (igual que la cabecera): el viewport re-emite el SGR de forma no fiable
// en pty (título y hint no llegaban, verificado) mientras lo estático sí.
// Si ya se vio (o hay sesiones), orientación mínima de una pantalla.
func (m *Model) maybeWelcome() {
	if welcomeSeen() || len(m.panel.Items) > 0 {
		m.addLine(lipgloss.NewStyle().Foreground(muted).Render("  " + T(m.lang, "welcome_line2")))
		m.addLine("")
		return
	}
	m.addLine(lipgloss.NewStyle().Foreground(muted).Render("  " + T(m.lang, "welcome_more")))
	m.addLine("")
	m.options = &optionsState{
		id:     "welcome",
		prompt: "",
		items: []optionItem{
			{Key: "connect", Label: T(m.lang, "welcome_connect"), Recommended: true},
			{Key: "skip", Label: T(m.lang, "welcome_skip")},
		},
		idx: 0,
	}
}

// renderWelcomeBlock pinta título + Kilo + nivel vivo como bloque estático (HH).
// TT2: welcome_line3 llega del motor con el nivel real ya sustituido
// (/v1/i18n); antes el catálogo traía "low" fijo y ni se pintaba.
func (m *Model) renderWelcomeBlock() string {
	if m.options == nil || m.options.id != "welcome" {
		return ""
	}
	return lipgloss.NewStyle().Foreground(accent).Bold(true).Render("  " + T(m.lang, "welcome_title")) + "\n" +
		lipgloss.NewStyle().Foreground(green).Render("  ✓ " + T(m.lang, "welcome_kilo")) + "\n" +
		lipgloss.NewStyle().Foreground(muted).Render("  " + T(m.lang, "welcome_line3")) + "\n"
}

// chooseWelcome resuelve la bienvenida (Enter, número o clic).
func (m *Model) chooseWelcome(key string) {
	setWelcomeSeen()
	m.options = nil
	if key != "connect" {
		return
	}
	m.doLogin()
}

// doLogin lanza el OAuth en el servidor y pinta el resultado. Compartido
// por /login y la bienvenida.
func (m *Model) doLogin() {
	m.addLine(lipgloss.NewStyle().Foreground(accent).Render("  " + T(m.lang, "login_wait")))
	m.thinking = true
	m.setStatus()
	go func() {
		ok, msg := m.client.Login()
		m.thinking = false
		if ok {
			m.addLine(lipgloss.NewStyle().Foreground(green).Render("  ✓ " + msg))
		} else {
			m.addLine(lipgloss.NewStyle().Foreground(red).Render("  ✗ " + msg))
		}
		m.setStatus()
		if m.program != nil {
			m.program.Send(tea.ClearScreen())
		}
	}()
}

// slashItems devuelve los comandos con / que casan con lo escrito. Se filtran
// por prefijo y, en cuanto hay un espacio, el menú se cierra (el comando ya
// lleva argumentos y no hay nada que elegir).
func (m *Model) slashItems() []optionItem {
	q := strings.TrimSpace(m.input.Value())
	if !strings.HasPrefix(q, "/") || strings.Contains(q, " ") {
		return nil
	}
	out := make([]optionItem, 0, len(slashCmds))
	for _, c := range slashCmds {
		if strings.HasPrefix(c, q) {
			label := c
			if d := m.slashDesc(c); d != "" {
				label = c + " — " + d
			}
			out = append(out, optionItem{Key: c, Label: label})
		}
	}
	return out
}

// isSlashCmd dice si el texto es exactamente un comando con /.
func isSlashCmd(v string) bool {
	for _, c := range slashCmds {
		if v == c {
			return true
		}
	}
	return false
}

// syncSlash abre/cierra el menú según lo que hay escrito. Se llama tras cada
// tecla de escritura para que / siempre muestre la lista y cualquier otra
// entrada la cierre.
func (m *Model) syncSlash() {
	raw := m.input.Value()
	v := strings.TrimSpace(raw)
	// El espacio se mira en el valor CRUDO: "/copy " (tras elegir) lleva un
	// espacio final que TrimSpace quitaría y reabriría el menú en bucle.
	if strings.HasPrefix(v, "/") && !strings.Contains(raw, " ") {
		if !m.slashOpen {
			m.slashOpen = true
			m.slashIdx = 0
		} else if m.slashFilter != v {
			// El prefijo cambió al escribir/borrar: el cursor viejo ya no
			// vale, se vuelve arriba.
			m.slashIdx = 0
		}
		m.slashFilter = v
		return
	}
	m.slashOpen = false
	m.slashIdx = 0
	m.slashFilter = ""
}

// slashKey navega el menú con flechas/Enter/Esc.
func (m *Model) slashKey(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	items := m.slashItems()
	if len(items) == 0 {
		m.slashOpen = false
		return m, nil
	}
	if m.slashIdx >= len(items) {
		m.slashIdx = len(items) - 1
	}
	if m.slashIdx < 0 {
		m.slashIdx = 0
	}
	switch msg.String() {
	case "up", "up.Up":
		if m.slashIdx > 0 {
			m.slashIdx--
		}
	case "down", "down.Down":
		if m.slashIdx < len(items)-1 {
			m.slashIdx++
		}
	case "enter":
		// El texto es EXACTAMENTE un comando ("/connect", no "/con"): se
		// EJECUTA directo. Si no, Enter ELIGE y rellena la entrada (el
		// segundo Enter lo lanza), como hacía Tab.
		if v := strings.TrimSpace(m.input.Value()); isSlashCmd(v) {
			m.slashOpen = false
			m.slashIdx = 0
			return m.doEnter()
		}
		m.slashPick(m.slashIdx)
	case "esc":
		m.slashOpen = false
	}
	return m, nil
}

// slashPick mete el comando elegido en la entrada (con espacio detrás) y cierra
// el menú. No lanza el comando: eso es al segundo Enter, como con Tab.
func (m *Model) slashPick(idx int) {
	items := m.slashItems()
	if idx < 0 || idx >= len(items) {
		return
	}
	m.input.SetValue(items[idx].Key + " ")
	m.input.CursorEnd()
	m.slashOpen = false
	m.slashIdx = 0
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
		m.addLine(lipgloss.NewStyle().Foreground(accent).Bold(true).Render("  " + T(m.lang, "help_section_cmds")))
		m.addLine("  " + T(m.lang, "help_cmds"))
		m.addLine("")
		m.addLine(lipgloss.NewStyle().Foreground(accent).Bold(true).Render("  " + T(m.lang, "help_section_keys")))
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
	case "/connections":
		conns, err := m.client.Connections()
		if err != nil {
			m.addLine(T(m.lang, "err_model") + err.Error())
			return true
		}
		m.addLine("")
		m.addLine(lipgloss.NewStyle().Foreground(gold).Bold(true).Render("  " + "Connections"))
		m.addLine("")
		for _, c := range conns {
			mark := lipgloss.NewStyle().Foreground(muted).Render("[ ]")
			if c.Connected {
				mark = lipgloss.NewStyle().Foreground(green).Render("[✓]")
			}
			m.addLine("  " + mark + " " + c.Name + " — " + lipgloss.NewStyle().Foreground(muted).Render(c.Note))
		}
		m.addLine("")
		m.addLine(lipgloss.NewStyle().Foreground(muted).Render("  " + T(m.lang, "conn_use")))
		m.addLine("")
		return true
	case "/connect":
		// H8: formulario de conexión — muestra opciones con enlaces y campo para pegar
		conns, err := m.client.Connections()
		if err != nil {
			m.addLine(T(m.lang, "err_model") + err.Error())
			return true
		}
		m.addLine("")
		m.addLine(lipgloss.NewStyle().Foreground(gold).Bold(true).Render("  " + T(m.lang, "connect_title")))
		m.addLine("")
		// Top providers that are most commonly used
		topProviders := map[string]bool{"openrouter": true, "github_token": true, "cloudflare_api_token": true}
		optsList := []optionItem{}
		for _, c := range conns {
			status := lipgloss.NewStyle().Foreground(muted).Render(T(m.lang, "conn_disconnected"))
			if c.Connected {
				status = lipgloss.NewStyle().Foreground(green).Render(T(m.lang, "conn_connected"))
			}
			m.addLine("  " + status + " " + c.Name)
			m.addLine("    " + lipgloss.NewStyle().Foreground(muted).Render(c.Note))
			if c.ID != "kilo" {
				m.addLine("    " + lipgloss.NewStyle().Foreground(accent).Render(T(m.lang, "connect_get_key")))
				isTop := topProviders[c.ID] || topProviders[c.ID+"_token"]
				optsList = append(optsList, optionItem{Key: c.ID, Label: c.Name, Recommended: isTop && !c.Connected})
			}
			m.addLine("")
		}
		// Si hay opciones pendientes, usar H10 options
		if len(optsList) > 0 {
			m.addLine(lipgloss.NewStyle().Foreground(muted).Render("  " + T(m.lang, "connect_prompt")))
			m.options = &optionsState{
				id:     "connect-form",
				prompt: T(m.lang, "connect_select"),
				items:  optsList,
				idx:    0,
			}
		}
		m.addLine("")
		return true
	case "/explain":
		sid := m.sessionID
		if len(parts) > 1 {
			sid = parts[1]
		}
		if sid == "" {
			m.addLine(T(m.lang, "explain_no_session"))
			return true
		}
		explain, err := m.client.Explain(sid)
		if err != nil {
			m.addLine(T(m.lang, "err_model") + err.Error())
			return true
		}
		m.addLine("")
		m.addLine(lipgloss.NewStyle().Foreground(gold).Bold(true).Render("  " + "Explain"))
		m.addLine("")
		m.addLine("  " + lipgloss.NewStyle().Foreground(muted).Render("pregunta:") + " " + explain.Pregunta)
		m.addLine("  " + lipgloss.NewStyle().Foreground(muted).Render("respuesta:") + " " + explain.Respuesta)
		m.addLine("  " + lipgloss.NewStyle().Foreground(muted).Render("turnos:") + " " + fmt.Sprint(explain.Turnos))
		m.addLine("")
		return true
	case "/quit":
		return true
	case "/deploy":
		// GG: paridad con /deploy del REPL (Vercel/static vía deployTool;
		// la confirmación la pide el SERVIDOR por SSE con su diálogo real).
		target := "vercel"
		if len(parts) > 1 {
			if parts[1] != "vercel" && parts[1] != "static" {
				m.addLine(T(m.lang, "deploy_usage"))
				return true
			}
			target = parts[1]
		}
		m.addLine(lipgloss.NewStyle().Foreground(accent).Render("  " + T(m.lang, "deploy_running")))
		m.thinking = true
		m.setStatus()
		go func() {
			ok, out := m.client.Deploy(target)
			m.thinking = false
			for _, ln := range strings.Split(strings.TrimSpace(out), "\n") {
				if strings.TrimSpace(ln) != "" {
					m.addLine("  " + ln)
				}
			}
			if !ok && strings.TrimSpace(out) == "" {
				m.addLine(T(m.lang, "err_line") + target)
			}
			m.setStatus()
			if m.program != nil {
				m.program.Send(tea.ClearScreen())
			}
		}()
		return true
	case "/logout":
		// GG: paridad con /logout del REPL; confirma en cliente (diálogo
		// existente, como borrar sesión) y el servidor ejecuta tras el POST.
		m.confirm = &confirmState{kind: "logout", detail: T(m.lang, "logout_confirm")}
		return true
	case "/login":
		// HH/GG: paridad con /login del REPL; el OAuth corre en el servidor
		// (abre el navegador local) y aquí solo se muestra el resultado.
		m.doLogin()
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
		m.addLine(lipgloss.NewStyle().Foreground(accent).Bold(true).Render("  MCP Servers"))
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
	case "/agents":
		// H2: mostrar roster de agentes y su estado.
		m.addLine("")
		m.addLine(lipgloss.NewStyle().Foreground(accent).Bold(true).Render("  Agent Roster"))
		m.addLine("")
		agents := []struct{ role, desc, tools string }{
			{"orchestrator", T(m.lang, "agent_orchestrator"), "list, read, write, edit, bash, git"},
			{"code", T(m.lang, "agent_code"), "read, write, edit, list, bash, git"},
			{"research", T(m.lang, "agent_research"), "list, read, bash, git"},
			{"review", T(m.lang, "agent_review"), "read, list, bash, git"},
			{"security", T(m.lang, "agent_security"), "read, list, bash, git"},
		}
		for _, a := range agents {
			m.addLine("  " + lipgloss.NewStyle().Foreground(gold).Render(a.role) +
				lipgloss.NewStyle().Foreground(muted).Render(" — "+a.desc))
			m.addLine("    " + lipgloss.NewStyle().Foreground(muted).Render(a.tools))
		}
		m.addLine("")
		m.addLine(lipgloss.NewStyle().Foreground(muted).Render("  "+T(m.lang, "agents_parallel_hint")))
		m.addLine("")
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
	// H9: unknown command — suggest similar commands
	input := parts[0]
	similar := []string{}
	known := []string{"/help", "/sessions", "/resume", "/new", "/plan", "/build", "/model", "/lang", "/title", "/learn", "/mouse", "/copy", "/mcp", "/parallel", "/agents", "/connections", "/connect", "/explain", "/deploy", "/logout", "/login", "/quit"}
	for _, k := range known {
		if strings.HasPrefix(k, input) || strings.Contains(k, input) {
			similar = append(similar, k)
		}
	}
	if len(similar) > 0 {
		m.addLine(F(m.lang, "unknown_cmd", map[string]string{"cmd": input}) + " " + strings.Join(similar, ", "))
	} else {
		m.addLine(F(m.lang, "unknown_cmd", map[string]string{"cmd": input}) + " — " + T(m.lang, "help_cmds"))
	}
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
		m.modelName = str(ev, "modelo")
		if m.modelName == "" || m.modelName == "(router)" {
			m.modelName = str(ev, "level")
		}
		m.addLine("")
		m.addLine(lipgloss.NewStyle().Foreground(gold).Bold(true).Render("  > NOIRACODER") +
			lipgloss.NewStyle().Foreground(muted).Render("  "+T(m.lang, "boot_hint")))
		m.addLine("")
		m.setStatus()
		m.refreshPanel()
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
		// HH: bienvenida (primer arranque) u orientación breve (vuelta).
		m.maybeWelcome()
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
	case "options.request":
		items := []optionItem{}
		if arr, ok := ev.Data["opciones"].([]interface{}); ok {
			for _, v := range arr {
				if obj, ok := v.(map[string]interface{}); ok {
					items = append(items, optionItem{
						Key:         obj["key"].(string),
						Label:       obj["label"].(string),
						Recommended: obj["recommended"] == true,
					})
				}
			}
		}
		m.options = &optionsState{id: str(ev, "optionsId"), prompt: str(ev, "prompt"), items: items, idx: 0}
	case "options.result":
		m.addLine(F(m.lang, "confirm_result", map[string]string{"reason": str(ev, "choice") + ": " + str(ev, "motivo")}))
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

// nl cuenta saltos de línea (vale para "" → 0, sin casos especiales).
// OJO: no usar "nº de líneas" (Count+1) para sumar bloques: cada +1
// fantasma por bloque desborda la cuenta ~12 líneas y la ventana se
// encoge de más (HALLAZGO menú corto: a 24 filas mostraba 1 opción
// cuando cabían 8). Con nl la cuenta es exacta.
func nl(s string) int {
	return strings.Count(s, "\n")
}

// fitBox renderiza la caja de opciones encogiendo la ventana hasta que el
// frame completo quepa en la pantalla (HALLAZGO menú corto: en terminales
// de ≤25 filas las primeras opciones se salían por arriba sin forma de
// verlas, y parecían "perdidas"). Al abrir, el cursor está en 0 y la
// ventana empieza en 0: la opción 1 siempre visible. El scroll con
// marcadores solo aparece al navegar más allá de lo visible, nunca al abrir.
// fixedNL son los "\n" del frame sin la caja (ver View); total = fixedNL +
// 1 + nl(box) + 1 + 1.
func (m *Model) fitBox(prompt string, items []optionItem, idx int, zoneID string, fixedNL int) string {
	w := len(items)
	if w > maxOptionRows {
		w = maxOptionRows
	}
	cap := w
	compact := false
	box := m.renderOptionsBoxCap(prompt, items, idx, zoneID, cap, compact)
	// Solo itera si desborda (pantallas cortas); en terminales normales es
	// una sola renderización, como antes. Último recurso: caja compacta.
	for i := 0; i <= maxOptionRows+1 && m.height > 0; i++ {
		if fixedNL+1+nl(box)+1+1 <= m.height {
			break
		}
		if cap > 1 {
			cap--
		} else if !compact {
			compact = true
		} else {
			break
		}
		box = m.renderOptionsBoxCap(prompt, items, idx, zoneID, cap, compact)
	}
	return box
}

// maxOptionRows es la ventana visible de la caja (JJ): con 22 comandos no
// cabe entera; se muestra una ventana con marcadores de scroll.
const maxOptionRows = 10

// optionWindow devuelve [inicio, fin) visibles alrededor del cursor.
func optionWindow(total, idx int) (int, int) {
	return optionWindowCap(total, idx, maxOptionRows)
}

// optionWindowCap igual con tope de filas dado (HALLAZGO menú corto: en
// terminales de pocas filas la ventana se encoge para que el frame quepa;
// el cursor sigue siempre visible y la opción 1 al abrir).
func optionWindowCap(total, idx, cap int) (int, int) {
	if cap < 1 {
		cap = 1
	}
	if total <= cap {
		return 0, total
	}
	start := idx - 4
	if start < 0 {
		start = 0
	}
	if start > total-cap {
		start = total - cap
	}
	return start, start + cap
}

// renderOptionsBox es el componente único de lista seleccionable (H10 para las
// opciones del motor, M para el menú de "/"): borde en acento, título en
// acento, fila activa en acento+negrita con cursor "▸", filas numeradas,
// zona de clic por fila y aire dentro de la caja. Bordes redondeados cortos
// (~4px), no cajas pesadas.
func (m *Model) renderOptionsBox(prompt string, items []optionItem, idx int, zoneID string) string {
	return m.renderOptionsBoxCap(prompt, items, idx, zoneID, maxOptionRows, false)
}

// renderOptionsBoxCap igual con tope de filas visibles (HALLAZGO menú
// corto: la ventana se encoge hasta que el frame quepa en pantalla).
// compact quita blancos + ayuda (último recurso en pantallas mínimas;
// título, filas y marcadores se conservan).
func (m *Model) renderOptionsBoxCap(prompt string, items []optionItem, idx int, zoneID string, cap int, compact bool) string {
	title := prompt
	if title == "" {
		title = T(m.lang, "options_title")
	}
	lines := []string{lipgloss.NewStyle().Foreground(accent).Bold(true).Render(title)}
	if len(items) > 1 && !compact {
		lines = append(lines, "")
	}
	// JJ: ventana con scroll (el cursor siempre visible + marcadores).
	lo, hi := optionWindowCap(len(items), idx, cap)
	if lo > 0 {
		lines = append(lines, lipgloss.NewStyle().Foreground(muted).Render(
			F(m.lang, "opt_more_up", map[string]string{"n": fmt.Sprint(lo)})))
	}
	for i := lo; i < hi; i++ {
		item := items[i]
		suffix := ""
		if item.Recommended {
			suffix = "  " + lipgloss.NewStyle().Foreground(green).Render(T(m.lang, "options_recommended"))
		}
		// La fila activa combina ▸ en acento + texto en inversa+negrita.
		// Nota Windows/ConPTY: el fg truecolor del CONTENIDO del diálogo no
		// siempre llega (el borde y la cabecera sí); la inversa+negrita y el
		// marcador ▸ se ven en todos los terminales, y en los que sí pasan
		// el truecolor el ▸ va en acento. Selección igual que la del panel.
		var row string
		if i == idx {
			mark := lipgloss.NewStyle().Foreground(accent).Render("▸")
			text := lipgloss.NewStyle().Reverse(true).Bold(true).
				Render(fmt.Sprintf("%d", i+1) + ". " + item.Label)
			row = mark + " " + text + suffix
		} else {
			row = "  " + lipgloss.NewStyle().Foreground(muted).Render(fmt.Sprintf("%d", i+1)+".") +
				" " + item.Label + suffix
		}
		lines = append(lines, zone.Mark(zoneID+":"+strconv.Itoa(i), row))
	}
	if hi < len(items) {
		lines = append(lines, lipgloss.NewStyle().Foreground(muted).Render(
			F(m.lang, "opt_more_down", map[string]string{"n": fmt.Sprint(len(items) - hi)})))
	}
	if !compact {
		lines = append(lines, "")
		lines = append(lines, lipgloss.NewStyle().Foreground(muted).Render(T(m.lang, "options_hint")))
	}
	box := lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(accent).Padding(1, 2)
	return box.Render(strings.Join(lines, "\n"))
}

func (m *Model) View() string {
	if m.fatal != "" {
		return lipgloss.NewStyle().Foreground(red).Render("NOIRACODER: "+m.fatal+"\n") +
			T(m.lang, "fatal_line") + "\n"
	}
	// M3.1: header con marca dorada + modelo en accent si es manual.
	modelLabel := m.modelName
	if m.modelName != "(router)" {
		modelLabel = lipgloss.NewStyle().Foreground(accent).Bold(true).Render(m.modelName)
	} else {
		modelLabel = lipgloss.NewStyle().Foreground(muted).Render(m.modelName)
	}
	// M3.6: modo con color distintivo.
	modeLabel := m.mode
	switch m.mode {
	case "build":
		modeLabel = lipgloss.NewStyle().Foreground(accent).Bold(true).Render("build")
	case "plan":
		modeLabel = lipgloss.NewStyle().Foreground(green).Bold(true).Render("plan")
	}
	// N: cabecera con acento visible + filete separador para que respire.
	head := lipgloss.NewStyle().Foreground(accent).Bold(true).Render("> NOIRACODER")
	if m.sessName != "" {
		head += lipgloss.NewStyle().Foreground(muted).Render("  · ") +
			lipgloss.NewStyle().Foreground(accent).Render(runewidth.Truncate(Sanitize(m.sessName), 24, "…"))
	}
	head += "  " + modelLabel + lipgloss.NewStyle().Foreground(muted).Render(" · ") + modeLabel
	head += "\n" + lipgloss.NewStyle().Foreground(border).Render(strings.Repeat("─", maxInt(m.chatW, 20)))

	// JJ: el alto se recalcula en cada frame con el diálogo visible para que
	// cabecera + diálogo + entrada quepan siempre (ver chatViewportHeight).
	m.viewport.Height = m.chatViewportHeight()
	if m.viewport.Height < 3 {
		m.viewport.Height = 3
	}
	body := m.viewport.View()
	// HH: bloque estático de bienvenida (título + Kilo) entre filete y chat.
	welcome := m.renderWelcomeBlock()
	// La entrada/hints/estado no dependen del diálogo: se construyen antes
	// para medir el frame (HALLAZGO menú corto, ver fitBox).
	boxIn := lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(accent).Padding(0, 2)
	in := boxIn.Render(m.input.View())
	hints := lipgloss.NewStyle().Foreground(muted).Render(T(m.lang, "hints"))
	extra := ""
	if m.mouseOn {
		extra = "\n" + lipgloss.NewStyle().Foreground(muted).Render(
			runewidth.Truncate(T(m.lang, "mouse_hint"), m.chatW, ""))
	}
	st := lipgloss.NewStyle().Foreground(muted).Render(m.status)
	// fixedNL son los "\n" del frame SIN la caja de diálogo (los dos "\n"
	// que la envuelven cuentan aquí). Con nl() la cuenta es exacta.
	fixedNL := nl(head) + 1 + nl(welcome) + nl(body) +
		1 + 1 + nl(in) + 2 + nl(hints) + nl(extra) + 1 + nl(st)
	var dlg string
	if m.confirm != nil {
		box := lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(accent).Padding(1, 2)
		dlg = "\n" + box.Render(lipgloss.NewStyle().Bold(true).Foreground(accent).Render(T(m.lang, "confirm_q"))+"\n"+
			m.confirm.detail+"\n\n"+T(m.lang, "confirm_yn")) + "\n"
	}
	// H10: opciones seleccionables — diálogo. El menú de "/" (M) reutiliza la
	// MISMA caja para que se comporten igual: acento, cursor visible, clic.
	if m.options != nil {
		dlg = "\n" + m.fitBox(m.options.prompt, m.options.items, m.options.idx, "opt", fixedNL) + "\n"
	}
	if m.slashOpen {
		if items := m.slashItems(); len(items) > 0 {
			dlg = "\n" + m.fitBox("", items, m.slashIdx, "slash", fixedNL) + "\n"
		}
	}
	// La entrada es el elemento con el foco: borde en acento para que se vea
	// dónde estás. Padding lateral 2 para que respire.
	chat := head + "\n" + welcome + body + dlg + "\n" + in + "\n\n" + hints + extra + "\n" + st
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
	// N: la cabecera ahora son 2 líneas (título + filete) y hay una en blanco
	// antes de los hints. Sin este -2 la vista desbordaba pantallas de 34
	// filas y la primera línea (cabecera) se salía por arriba.
	// JJ: además se resta el diálogo visible (ver dlgHeight): con la caja
	// abierta el chat se encoge en vez de empujar la cabecera fuera.
	m.viewport.Height = m.chatViewportHeight()
	if m.viewport.Height < 3 {
		m.viewport.Height = 3
	}
	m.input.SetWidth(chatW - 6)
	if m.input.Width() < 10 {
		m.input.SetWidth(10)
	}
}

// dlgHeight reserva filas para el diálogo visible (confirm/opciones/menú).
// Sin esto, la caja inline empujaba la cabecera fuera de la pantalla.
// Con ventana (optionWindow) solo cuentan las filas visibles + marcadores.
func (m *Model) dlgHeight() int {
	h := 0
	if m.confirm != nil {
		h = 8
	}
	visRows := func(total, idx int) int {
		if total <= maxOptionRows {
			return total
		}
		return maxOptionRows + 2 // ventana + 2 marcadores
	}
	if m.options != nil {
		n := visRows(len(m.options.items), m.options.idx)
		dh := 8 + n
		if len(m.options.items) > 1 {
			dh++
		}
		if dh > h {
			h = dh
		}
	}
	if m.slashOpen {
		if items := m.slashItems(); len(items) > 0 {
			n := visRows(len(items), m.slashIdx)
			dh := 8 + n
			if len(items) > 1 {
				dh++
			}
			if dh > h {
				h = dh
			}
		}
	}
	return h
}

// chatViewportHeight es la fuente única del alto del chat (relayout y View).
func (m *Model) chatViewportHeight() int {
	ih := 3
	if m.height < 18 {
		ih = 1
	}
	extra := 1 // línea mouse_hint cuando el ratón está activo
	if !m.mouseOn {
		extra = 0
	}
	return m.height - (2 + ih + 2 + 2 + 1) - 1 - extra - m.dlgHeight()
}
