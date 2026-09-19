package thinclient

// HITO 2.4 - corpus de saneo de pantalla. Falla si algo malicioso pasa.

import (
	"strings"
	"testing"
)

func TestSanitizeCorpus(t *testing.T) {
	long := strings.Repeat("x", 3000)
	cases := []struct {
		name  string
		input string
		want  string
	}{
		{"clear", "\x1b[2J\x1b[Hhola", "hola"},
		{"colores", "\x1b[32m[y]\x1b[0m si", "[y] si"},
		{"osc8-link", "\x1b]8;;http://evil\x1b\\click\x1b]8;;\x1b\\", "click"},
		{"titulo", "\x1b]0;pwned\x07X", "X"},
		{"cpr", "\x1b[6n", ""},
		{"c0", "a\x01\x02b\nc\td", "ab\nc\td"},
		{"del", "a\x7fb", "ab"},
		{"bidi", "a‮evil", "aevil"},
		{"apc", "\x1bPqr\x1b\\X", "X"},
		{"c1", "a\x9b2Kb", "ab"},
		{"normal-es-ar", "hola cañón مرحبا", "hola cañón مرحبا"},
	}
	for _, c := range cases {
		got := Sanitize(c.input)
		if got != c.want {
			t.Errorf("%s: got=%q want=%q", c.name, got, c.want)
		} else {
			t.Logf("[PASS] %s", c.name)
		}
	}
	got := Sanitize(long)
	wantSuffix := "…[truncado]"
	if !strings.HasSuffix(got, wantSuffix) || len(got) > maxLineLen+len(wantSuffix) {
		t.Errorf("truncado: len=%d sufijo=%q", len(got), got[len(got)-20:])
	} else {
		t.Logf("[PASS] truncado len=%d", len(got))
	}
	// La barra de confirmación real nunca sale de texto saneado: el
	// recordatorio estructural (este test no puede simular UI, lo cubre H2.5).
}
