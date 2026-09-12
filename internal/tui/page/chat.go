package page

import (
	"context"
	"strings"

	"github.com/charmbracelet/bubbles/key"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/opencode-ai/opencode/internal/app"
	"github.com/opencode-ai/opencode/internal/completions"
	"github.com/opencode-ai/opencode/internal/message"
	"github.com/opencode-ai/opencode/internal/session"
	"github.com/opencode-ai/opencode/internal/tui/components/chat"
	"github.com/opencode-ai/opencode/internal/tui/components/dialog"
	"github.com/opencode-ai/opencode/internal/tui/layout"
	"github.com/opencode-ai/opencode/internal/tui/theme"
	"github.com/opencode-ai/opencode/internal/tui/util"
)

var ChatPage PageID = "chat"

type chatPage struct {
	app                  *app.App
	editor               layout.Container
	messages             layout.Container
	mainLayout           layout.SplitPaneLayout
	chatLayout           layout.SplitPaneLayout
	sessionSidebar       chat.SessionSidebar
	session              session.Session
	completionDialog     dialog.CompletionDialog
	showCompletionDialog bool
	width, height        int
}

type ChatKeyMap struct {
	ShowCompletionDialog key.Binding
	NewSession           key.Binding
	Cancel               key.Binding
}

var keyMap = ChatKeyMap{
	ShowCompletionDialog: key.NewBinding(
		key.WithKeys("@"),
		key.WithHelp("@", "Complete"),
	),
	NewSession: key.NewBinding(
		key.WithKeys("ctrl+n"),
		key.WithHelp("ctrl+n", "new session"),
	),
	Cancel: key.NewBinding(
		key.WithKeys("esc"),
		key.WithHelp("esc", "cancel"),
	),
}

func (p *chatPage) Init() tea.Cmd {
	cmds := []tea.Cmd{
		p.mainLayout.Init(),
		p.chatLayout.Init(),
		p.completionDialog.Init(),
		p.sessionSidebar.Init(),
	}
	return tea.Batch(cmds...)
}

func (p *chatPage) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		p.width = msg.Width
		p.height = msg.Height
		// Session sidebar takes 25% of width, minimum 20, max 30
		sidebarWidth := msg.Width / 4
		if sidebarWidth < 20 {
			sidebarWidth = 20
		}
		if sidebarWidth > 30 {
			sidebarWidth = 30
		}
		chatWidth := msg.Width - sidebarWidth

		cmd := p.mainLayout.SetSize(msg.Width, msg.Height)
		cmds = append(cmds, cmd)
		cmd = p.chatLayout.SetSize(chatWidth, msg.Height)
		cmds = append(cmds, cmd)
	case dialog.CompletionDialogCloseMsg:
		p.showCompletionDialog = false
	case chat.SendMsg:
		cmd := p.sendMessage(msg.Text, msg.Attachments)
		if cmd != nil {
			return p, cmd
		}
	case dialog.CommandRunCustomMsg:
		if p.app.CoderAgent.IsBusy() {
			return p, util.ReportWarn("Agent is busy, please wait before executing a command...")
		}
		content := msg.Content
		if msg.Args != nil {
			for name, value := range msg.Args {
				placeholder := "$" + name
				content = strings.ReplaceAll(content, placeholder, value)
			}
		}
		cmd := p.sendMessage(content, nil)
		if cmd != nil {
			return p, cmd
		}
	case chat.SessionSelectedMsg:
		p.session = msg
		p.sessionSidebar.SetActiveSession(p.session.ID)
		cmd := p.setFileSidebar()
		if cmd != nil {
			cmds = append(cmds, cmd)
		}
	case chat.SessionSidebarSelectedMsg:
		p.session = msg.Session
		p.sessionSidebar.SetActiveSession(p.session.ID)
		cmd := p.setFileSidebar()
		if cmd != nil {
			cmds = append(cmds, cmd)
		}
		cmds = append(cmds, util.CmdHandler(chat.SessionSelectedMsg(p.session)))
	case chat.SessionSidebarNewSessionMsg:
		p.session = session.Session{}
		cmds = append(cmds,
			p.clearFileSidebar(),
			util.CmdHandler(chat.SessionClearedMsg{}),
		)
	case tea.KeyMsg:
		switch {
		case key.Matches(msg, keyMap.ShowCompletionDialog):
			p.showCompletionDialog = true
		case key.Matches(msg, keyMap.NewSession):
			p.session = session.Session{}
			return p, tea.Batch(
				p.clearFileSidebar(),
				util.CmdHandler(chat.SessionClearedMsg{}),
			)
		case key.Matches(msg, keyMap.Cancel):
			if p.session.ID != "" {
				p.app.CoderAgent.Cancel(p.session.ID)
				return p, nil
			}
		}
	}

	// Update session sidebar
	u, cmd := p.sessionSidebar.Update(msg)
	p.sessionSidebar = u.(chat.SessionSidebar)
	if cmd != nil {
		cmds = append(cmds, cmd)
	}

	if p.showCompletionDialog {
		context, contextCmd := p.completionDialog.Update(msg)
		p.completionDialog = context.(dialog.CompletionDialog)
		cmds = append(cmds, contextCmd)
		if keyMsg, ok := msg.(tea.KeyMsg); ok {
			if keyMsg.String() == "enter" {
				return p, tea.Batch(cmds...)
			}
		}
	}

	u2, cmd := p.chatLayout.Update(msg)
	cmds = append(cmds, cmd)
	p.chatLayout = u2.(layout.SplitPaneLayout)

	return p, tea.Batch(cmds...)
}

func (p *chatPage) setFileSidebar() tea.Cmd {
	sidebarContainer := layout.NewContainer(
		chat.NewSidebarCmp(p.session, p.app.History),
		layout.WithPadding(1, 1, 1, 1),
	)
	return tea.Batch(p.chatLayout.SetRightPanel(sidebarContainer), sidebarContainer.Init())
}

func (p *chatPage) clearFileSidebar() tea.Cmd {
	return p.chatLayout.ClearRightPanel()
}

func (p *chatPage) sendMessage(text string, attachments []message.Attachment) tea.Cmd {
	var cmds []tea.Cmd
	if p.session.ID == "" {
		sess, err := p.app.Sessions.Create(context.Background(), "New Session")
		if err != nil {
			return util.ReportError(err)
		}
		p.session = sess
		p.sessionSidebar.SetActiveSession(sess.ID)
		// Refresh sessions list
		sessions, _ := p.app.Sessions.List(context.Background())
		p.sessionSidebar.SetSessions(sessions)
		cmd := p.setFileSidebar()
		if cmd != nil {
			cmds = append(cmds, cmd)
		}
		cmds = append(cmds, util.CmdHandler(chat.SessionSelectedMsg(sess)))
	}

	_, err := p.app.CoderAgent.Run(context.Background(), p.session.ID, text, attachments...)
	if err != nil {
		return util.ReportError(err)
	}
	return tea.Batch(cmds...)
}

func (p *chatPage) SetSize(width, height int) tea.Cmd {
	p.width = width
	p.height = height
	sidebarWidth := width / 4
	if sidebarWidth < 20 {
		sidebarWidth = 20
	}
	if sidebarWidth > 30 {
		sidebarWidth = 30
	}
	chatWidth := width - sidebarWidth

	cmds := []tea.Cmd{
		p.mainLayout.SetSize(width, height),
		p.chatLayout.SetSize(chatWidth, height),
	}
	return tea.Batch(cmds...)
}

func (p *chatPage) GetSize() (int, int) {
	return p.width, p.height
}

func (p *chatPage) View() string {
	t := theme.CurrentTheme()

	// Session sidebar view
	sidebarView := p.sessionSidebar.View()

	// Chat layout view (messages + editor + optional file sidebar)
	chatView := p.chatLayout.View()

	// Join them horizontally
	mainView := lipgloss.JoinHorizontal(lipgloss.Top, sidebarView, chatView)

	if p.showCompletionDialog {
		editorWidth, editorHeight := p.editor.GetSize()
		p.completionDialog.SetWidth(editorWidth)
		overlay := p.completionDialog.View()
		mainView = layout.PlaceOverlay(
			p.width/4,
			p.height-editorHeight-lipgloss.Height(overlay),
			overlay,
			mainView,
			false,
		)
	}

	// Apply background
	style := lipgloss.NewStyle().
		Width(p.width).
		Height(p.height).
		Background(t.Background())

	return style.Render(mainView)
}

func (p *chatPage) BindingKeys() []key.Binding {
	bindings := layout.KeyMapToSlice(keyMap)
	bindings = append(bindings, p.messages.BindingKeys()...)
	bindings = append(bindings, p.editor.BindingKeys()...)
	return bindings
}

func NewChatPage(app *app.App) tea.Model {
	cg := completions.NewFileAndFolderContextGroup()
	completionDialog := dialog.NewCompletionDialogCmp(cg)

	messagesContainer := layout.NewContainer(
		chat.NewMessagesCmp(app),
		layout.WithPadding(1, 1, 0, 1),
	)
	editorContainer := layout.NewContainer(
		chat.NewEditorCmp(app),
		layout.WithBorder(true, false, false, false),
	)

	sessionSidebar := chat.NewSessionSidebarCmp(app.Sessions)

	// Load existing sessions
	sessions, _ := app.Sessions.List(context.Background())
	sessionSidebar.SetSessions(sessions)

	// Chat layout: left=messages, bottom=editor, right=file sidebar (toggleable)
	chatLayout := layout.NewSplitPane(
		layout.WithLeftPanel(messagesContainer),
		layout.WithBottomPanel(editorContainer),
	)

	// Main layout: left=session sidebar, right=chat layout
	mainLayout := layout.NewSplitPane(
		layout.WithLeftPanel(layout.NewContainer(sessionSidebar)),
		layout.WithRightPanel(layout.NewContainer(chatLayout)),
	)

	return &chatPage{
		app:              app,
		editor:           editorContainer,
		messages:         messagesContainer,
		sessionSidebar:   sessionSidebar,
		chatLayout:       chatLayout,
		mainLayout:       mainLayout,
		completionDialog: completionDialog,
	}
}
