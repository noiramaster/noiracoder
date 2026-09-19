// Command noira-thin es la pantalla Go como CLIENTE FINO del motor TS.
// Lee puerto/token del entorno (los pone el wrapper, nunca argv) y abre la TUI.
// Sin motor no hay pantalla: error claro y salida ≠ 0 (el wrapper cae a Ink).
package main

import (
	"fmt"
	"os"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/opencode-ai/opencode/internal/thinclient"
)

func main() {
	port := os.Getenv("NOIRA_PORT")
	token := os.Getenv("NOIRA_TOKEN")
	if port == "" || token == "" {
		fmt.Fprintln(os.Stderr, "[noira-thin] faltan NOIRA_PORT/NOIRA_TOKEN en el entorno (los pone el wrapper).")
		os.Exit(2)
	}
	c := thinclient.NewClient(port, token)
	engine, err := c.Health()
	if err != nil {
		fmt.Fprintln(os.Stderr, "[noira-thin] motor no disponible:", err)
		os.Exit(3)
	}
	_ = engine
	m := thinclient.New(c)
	p := tea.NewProgram(m, tea.WithAltScreen())
	m.Attach(p)
	if _, err := p.Run(); err != nil {
		fmt.Fprintln(os.Stderr, "[noira-thin] error:", err)
		os.Exit(1)
	}
}
