//go:build !windows

package thinclient

import (
	"os"
	"syscall"
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

// WatchParent sale limpio si el wrapper muere (punto 3).
// Limitación honesta: si el PID se reutiliza, el check da falso vivo.
func WatchParent(p *tea.Program) {
	ppid := os.Getppid()
	go func() {
		for {
			time.Sleep(5 * time.Second)
			if err := syscall.Kill(ppid, 0); err != nil {
				p.Quit()
				return
			}
		}
	}()
}
