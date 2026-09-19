// Saneo de pantalla (base H1; corpus completo en Hito 2.4).
// Toda cadena de modelo/ficheros/herramientas pasa por Sanitize antes de pintarse.
package thinclient

import (
	"strings"
	"unicode"
)

const maxLineLen = 2000

// Sanitize elimina secuencias ANSI/OSC/C0 (salvo \n y \t) y trunca líneas.
func Sanitize(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	runes := []rune(s)
	for i := 0; i < len(runes); i++ {
		r := runes[i]
		// ESC / CSI / OSC / APC / SOS / PM / C1
		if r == 0x1b {
			i = skipEscape(runes, i)
			continue
		}
		if r == 0x9b { // CSI de un byte
			i = skipCSI(runes, i)
			continue
		}
		if r >= 0x80 && r <= 0x9f { // C1: se elimina
			continue
		}
		if unicode.IsControl(r) && r != '\n' && r != '\t' {
			continue
		}
		b.WriteRune(r)
	}
	// Trunca líneas kilométricas.
	lines := strings.Split(b.String(), "\n")
	for i, l := range lines {
		if len(l) > maxLineLen {
			lines[i] = l[:maxLineLen] + "…[truncado]"
		}
	}
	return strings.Join(lines, "\n")
}

// skipEscape salta desde ESC hasta el final de la secuencia.
func skipEscape(r []rune, i int) int {
	if i+1 >= len(r) {
		return i
	}
	n := r[i+1]
	switch {
	case n == '[':
		return skipCSI(r, i+1)
	case n == ']' || n == 'P' || n == 'X' || n == '^' || n == '_':
		// OSC/APC/SOS/PM: termina en BEL o ST (ESC \).
		for j := i + 2; j < len(r); j++ {
			if r[j] == 0x07 {
				return j
			}
			if r[j] == 0x1b && j+1 < len(r) && r[j+1] == '\\' {
				return j + 1
			}
		}
		return len(r) - 1
	case n == '(' || n == ')' || n == '#' || n == '%':
		if i+2 < len(r) {
			return i + 2
		}
		return len(r) - 1
	default: // ESC + un byte (p.ej. ESC M)
		return i + 1
	}
}

// skipCSI salta CSI … byte final (@–~).
func skipCSI(r []rune, i int) int {
	for j := i + 1; j < len(r); j++ {
		if r[j] >= 0x40 && r[j] <= 0x7e {
			return j
		}
	}
	return len(r) - 1
}
