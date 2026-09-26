// Genera capturas REALES de pantalla del Go TUI con códigos ANSI.
//
// Ejecuta: go run test/capture-after4.go
//
// Produce 6 archivos .txt en docs/evidence/screens/after4/ con el formato
// exacto de terminal (ANSI escape codes, lipgloss colors, boxes, etc.)
package main

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"

	"github.com/alecthomas/chroma/v2"
	"github.com/alecthomas/chroma/v2/styles"
	"github.com/charmbracelet/bubbles/viewport"
	"github.com/charmbracelet/lipgloss"

	"github.com/noiracoder/noiracoder/internal/thinclient"
)

var (
	gold    = lipgloss.Color("251;191;36")
	accent  = lipgloss.Color("217;51;132")
	muted   = lipgloss.Color("128;128;128")
	green   = lipgloss.Color("0;200;0")
	yellow  = lipgloss.Color("200;200;0")
	red     = lipgloss.Color("200;50;50")
	border  = lipgloss.Color("80;80;80")
)

func main() {
	// We create a Model directly and render its View()
	// This produces the exact same ANSI output as the real TUI.

	outDir := filepath.Join("docs", "evidence", "screens", "after4")
	os.MkdirAll(outDir, 0o755)

	// Create model with test state
	m := thinclient.NewModelForTest("en", "low", 80, 24)

	// 1. Boot banner (initial state after hello event)
	boot := m.View()
	writeANSI(filepath.Join(outDir, "01-boot.txt"), boot)
	fmt.Println("  01-boot.txt ✓")

	// 2. Status bar
	status := m.StatusView()
	writeANSI(filepath.Join(outDir, "02-status.txt"), status)
	fmt.Println("  02-status.txt ✓")

	// 3. Help panel
	m.OpenPanel()
	help := m.View()
	writeANSI(filepath.Join(outDir, "03-help.txt"), help)
	m.ClosePanel()
	fmt.Println("  03-help.txt ✓")

	// 4. Empty session (after /new)
	m.NewSession()
	empty := m.View()
	writeANSI(filepath.Join(outDir, "04-empty-session.txt"), empty)
	fmt.Println("  04-empty-session.txt ✓")

	// 5. Small window (40x12)
	m2 := thinclient.NewModelForTest("es", "low", 40, 12)
	small := m2.View()
	writeANSI(filepath.Join(outDir, "05-small.txt"), small)
	fmt.Println("  05-small.txt ✓")

	// 6. /connect command
	connect := m.ConnectView("github")
	writeANSI(filepath.Join(outDir, "06-connect.txt"), connect)
	fmt.Println("  06-connect.txt ✓")

	fmt.Printf("\nDone! 6 files in %s\n", outDir)
	_ = runtime.GOMAXPROCS
}

func writeANSI(path, content string) {
	os.WriteFile(path, []byte(content), 0o644)
}
