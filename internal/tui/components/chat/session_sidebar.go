package chat

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/key"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/opencode-ai/opencode/internal/session"
	"github.com/opencode-ai/opencode/internal/tui/layout"
	"github.com/opencode-ai/opencode/internal/tui/styles"
	"github.com/opencode-ai/opencode/internal/tui/theme"
	"github.com/opencode-ai/opencode/internal/tui/util"
)

// SessionSidebarSelectedMsg is sent when a session is selected from the sidebar
type SessionSidebarSelectedMsg struct {
	Session session.Session
}

// SessionSidebarNewSessionMsg is sent when the user requests a new session
type SessionSidebarNewSessionMsg struct{}

type sessionSidebarKeyMap struct {
	Up       key.Binding
	Down     key.Binding
	Enter    key.Binding
	New      key.Binding
	Delete   key.Binding
}

var sidebarKeys = sessionSidebarKeyMap{
	Up: key.NewBinding(
		key.WithKeys("up"),
		key.WithHelp("↑", "previous session"),
	),
	Down: key.NewBinding(
		key.WithKeys("down"),
		key.WithHelp("↓", "next session"),
	),
	Enter: key.NewBinding(
		key.WithKeys("enter"),
		key.WithHelp("enter", "load session"),
	),
	New: key.NewBinding(
		key.WithKeys("n"),
		key.WithHelp("n", "new session"),
	),
}

// SessionSidebar is a persistent sidebar that lists all sessions
type SessionSidebar interface {
	tea.Model
	layout.Bindings
	layout.Sizeable
	SetSessions(sessions []session.Session)
	SetActiveSession(sessionID string)
}

type sessionSidebarCmp struct {
	app             AppInterface
	sessions        []session.Session
	activeSessionID string
	selectedIdx     int
	width           int
	height          int
	service         session.Service
}

// AppInterface is the interface we need from app.App
type AppInterface interface {
	CreateSession(ctx context.Context, title string) (session.Session, error)
}

func (s *sessionSidebarCmp) Init() tea.Cmd {
	return nil
}

func (s *sessionSidebarCmp) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch {
		case key.Matches(msg, sidebarKeys.Up):
			if s.selectedIdx > 0 {
				s.selectedIdx--
			}
			return s, nil
		case key.Matches(msg, sidebarKeys.Down):
			if s.selectedIdx < len(s.sessions)-1 {
				s.selectedIdx++
			}
			return s, nil
		case key.Matches(msg, sidebarKeys.Enter):
			if len(s.sessions) > 0 && s.selectedIdx < len(s.sessions) {
				return s, util.CmdHandler(SessionSidebarSelectedMsg{
					Session: s.sessions[s.selectedIdx],
				})
			}
			return s, nil
		case key.Matches(msg, sidebarKeys.New):
			return s, util.CmdHandler(SessionSidebarNewSessionMsg{})
		}
	case tea.WindowSizeMsg:
		s.width = msg.Width
		s.height = msg.Height
	}
	return s, nil
}

func (s *sessionSidebarCmp) View() string {
	t := theme.CurrentTheme()
	baseStyle := styles.BaseStyle()

	// Header
	header := baseStyle.
		Foreground(t.Primary()).
		Bold(true).
		Width(s.width).
		Padding(0, 1).
		Render("> NOIRA")

	// New session button
	newBtnStyle := baseStyle.
		Foreground(t.TextMuted()).
		Width(s.width).
		Padding(0, 1).
		Render("[n] New Session")

	separator := baseStyle.
		Foreground(t.BorderNormal()).
		Width(s.width).
		Render(strings.Repeat("─", s.width))

	if len(s.sessions) == 0 {
		emptyMsg := baseStyle.
			Foreground(t.TextMuted()).
			Width(s.width).
			Padding(1, 1).
			Render("No sessions yet.\nPress [n] to start.")
		return lipgloss.JoinVertical(
			lipgloss.Left,
			header,
			newBtnStyle,
			separator,
			emptyMsg,
		)
	}

	// Calculate max visible sessions (leave room for header, new btn, separator)
	maxVisible := s.height - 5
	if maxVisible < 3 {
		maxVisible = 3
	}

	// Build session list
	sessionItems := make([]string, 0, maxVisible)
	startIdx := 0

	if len(s.sessions) > maxVisible {
		halfVisible := maxVisible / 2
		if s.selectedIdx >= halfVisible && s.selectedIdx < len(s.sessions)-halfVisible {
			startIdx = s.selectedIdx - halfVisible
		} else if s.selectedIdx >= len(s.sessions)-halfVisible {
			startIdx = len(s.sessions) - maxVisible
		}
	}

	endIdx := min(startIdx+maxVisible, len(s.sessions))

	for i := startIdx; i < endIdx; i++ {
		sess := s.sessions[i]
		itemStyle := baseStyle.Width(s.width)

		title := sess.Title
		if title == "" {
			title = "Untitled"
		}
		// Truncate title if too long (guard s.width to avoid slice panic)
		if s.width > 10 && len(title) > s.width-6 {
			title = title[:s.width-9] + "..."
		} else if s.width > 0 && len(title) > s.width {
			if s.width > 3 {
				title = title[:s.width-3] + "..."
			} else {
				title = title[:s.width]
			}
		}

		// Format date
		createdAt := time.UnixMilli(sess.CreatedAt).Format("Jan 02")

		// Active session indicator
		isActive := sess.ID == s.activeSessionID
		var indicator string
		if isActive {
			indicator = baseStyle.Foreground(t.Primary()).Render("● ")
		} else {
			indicator = "  "
		}

		if i == s.selectedIdx {
			itemStyle = itemStyle.
				Background(t.BackgroundSecondary()).
				Foreground(t.Text()).
				Bold(true)
		} else if isActive {
			itemStyle = itemStyle.
				Foreground(t.Primary())
		} else {
			itemStyle = itemStyle.
				Foreground(t.TextMuted())
		}

		titleLine := fmt.Sprintf("%s%s", indicator, title)
		dateLine := baseStyle.
			Foreground(t.TextMuted()).
			Width(s.width - 4).
			Render(fmt.Sprintf("  %s", createdAt))

		sessionItems = append(sessionItems,
			itemStyle.Padding(0, 1).Render(titleLine),
			dateLine,
		)
	}

	// Scroll indicators
	if startIdx > 0 {
		scrollUp := baseStyle.
			Foreground(t.TextMuted()).
			Width(s.width).
			Padding(0, 1).
			Render("▲")
		sessionItems = append([]string{scrollUp}, sessionItems...)
	}
	if endIdx < len(s.sessions) {
		scrollDown := baseStyle.
			Foreground(t.TextMuted()).
			Width(s.width).
			Padding(0, 1).
			Render("▼")
		sessionItems = append(sessionItems, scrollDown)
	}

	return lipgloss.JoinVertical(
		lipgloss.Left,
		header,
		newBtnStyle,
		separator,
		lipgloss.JoinVertical(lipgloss.Left, sessionItems...),
	)
}

func (s *sessionSidebarCmp) BindingKeys() []key.Binding {
	return layout.KeyMapToSlice(sidebarKeys)
}

func (s *sessionSidebarCmp) SetSize(width, height int) tea.Cmd {
	s.width = width
	s.height = height
	return nil
}

func (s *sessionSidebarCmp) GetSize() (int, int) {
	return s.width, s.height
}

func (s *sessionSidebarCmp) SetSessions(sessions []session.Session) {
	s.sessions = sessions
	// Sort by most recent first
	for i := 0; i < len(sessions)-1; i++ {
		for j := i + 1; j < len(sessions); j++ {
			if sessions[j].CreatedAt > sessions[i].CreatedAt {
				s.sessions[i], s.sessions[j] = s.sessions[j], s.sessions[i]
			}
		}
	}

	// Update selected index for active session
	if s.activeSessionID != "" {
		for i, sess := range s.sessions {
			if sess.ID == s.activeSessionID {
				s.selectedIdx = i
				return
			}
		}
	}
	s.selectedIdx = 0
}

func (s *sessionSidebarCmp) SetActiveSession(sessionID string) {
	s.activeSessionID = sessionID
	for i, sess := range s.sessions {
		if sess.ID == sessionID {
			s.selectedIdx = i
			return
		}
	}
}

// NewSessionSidebarCmp creates a new session sidebar component
func NewSessionSidebarCmp(service session.Service) SessionSidebar {
	return &sessionSidebarCmp{
		sessions:    []session.Session{},
		service:     service,
		selectedIdx: 0,
	}
}
