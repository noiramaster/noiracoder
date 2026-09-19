// Saneo de pantalla (base H1; corpus completo en Hito 2.4).
// Toda cadena de modelo/ficheros/herramientas pasa por Sanitize antes de pintarse.
// Recorre BYTES (no runas): así los bytes C1 sueltos (0x80-0x9F, UTF-8 inválido)
// también se neutralizan en vez de convertirse en U+FFFD.
package thinclient

import (
	"strings"
	"unicode/utf8"
)

const maxLineLen = 2000

// Sanitize elimina secuencias ANSI/OSC/C0/C1 (salvo \n y \t), controles
// bidireccionales de spoofing y trunca líneas.
func Sanitize(s string) string {
	b := []byte(s)
	var out strings.Builder
	out.Grow(len(b))
	i := 0
	for i < len(b) {
		c := b[i]
		switch {
		case c == 0x1b:
			i = skipESCBytes(b, i)
		case c == 0x9b:
			i = skipCSIBytes(b, i)
		case c == 0x9d:
			i = skipOSCBytes(b, i)
		case c >= 0x80 && c <= 0x9f:
			i++ // C1 suelto: se elimina
		case c < 0x20:
			if c == '\n' || c == '\t' {
				out.WriteByte(c)
			}
			i++
		case c == 0x7f:
			i++
		default:
			r, size := utf8.DecodeRune(b[i:])
			if r == utf8.RuneError && size <= 1 {
				i++ // byte inválido: se elimina
				continue
			}
			if isBidi(r) {
				i += size
				continue
			}
			out.WriteString(string(b[i : i+size]))
			i += size
		}
	}
	// Trunca líneas kilométricas.
	lines := strings.Split(out.String(), "\n")
	for i, l := range lines {
		if len(l) > maxLineLen {
			lines[i] = l[:maxLineLen] + "…[truncado]"
		}
	}
	return strings.Join(lines, "\n")
}

func isBidi(r rune) bool {
	return (r >= 0x202a && r <= 0x202e) || (r >= 0x2066 && r <= 0x2069) ||
		r == 0x200e || r == 0x200f || r == 0x061c
}

// skipESCBytes salta desde ESC (0x1B) hasta el final de la secuencia.
func skipESCBytes(b []byte, i int) int {
	if i+1 >= len(b) {
		return len(b)
	}
	switch n := b[i+1]; {
	case n == '[':
		return skipCSIBytes(b, i+1)
	case n == ']' || n == 'P' || n == 'X' || n == '^' || n == '_':
		return skipOSCBytes(b, i+1)
	case n == '(' || n == ')' || n == '#' || n == '%':
		if i+2 < len(b) {
			return i + 3
		}
		return len(b)
	default:
		return i + 2
	}
}

// skipCSIBytes salta CSI … byte final (@-~).
func skipCSIBytes(b []byte, i int) int {
	for j := i + 1; j < len(b); j++ {
		if b[j] >= 0x40 && b[j] <= 0x7e {
			return j + 1
		}
	}
	return len(b)
}

// skipOSCBytes salta OSC … (BEL o ST).
func skipOSCBytes(b []byte, i int) int {
	for j := i + 1; j < len(b); j++ {
		if b[j] == 0x07 {
			return j + 1
		}
		if b[j] == 0x1b && j+1 < len(b) && b[j+1] == '\\' {
			return j + 2
		}
	}
	return len(b)
}
