//go:build windows

package thinclient

import (
	"os"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"golang.org/x/sys/windows"
)

// WatchParent sale limpio (restaura la terminal) si el wrapper muere.
// Sin esto, cerrar la ventana dejaba la Go huérfana (punto 3).
// Limitación honesta: si el PID se reutiliza, el check da falso vivo.
func WatchParent(p *tea.Program) {
	ppid := os.Getppid()
	go func() {
		for {
			time.Sleep(5 * time.Second)
			h, err := windows.OpenProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, uint32(ppid))
			if err != nil {
				p.Quit()
				return
			}
			windows.CloseHandle(h)
		}
	}()
}
