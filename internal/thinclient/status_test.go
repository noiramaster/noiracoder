package thinclient

import (
	"strings"
	"testing"
)

// A2/M1.1: la barra de estado muestra modelo/modo/sesión siempre y el segmento
// de cuota solo cuando hay dato (quotaPct > 0). Sin dato no se inventa.
// El catálogo lo pone el test (en producción viene de /v1/i18n).
func TestSetStatusQuota(t *testing.T) {
	SetCatalog(map[string]string{
		"st_model": "model", "st_mode": "mode", "st_session": "session",
		"st_quota": "quota",
	})
	cases := []struct {
		lang      string
		base      []string
		quotaWant string
	}{
		{"en", []string{"model: (router)", "mode: build", "session: —"}, "8%"},
	}
	for _, c := range cases {
		m := &Model{lang: c.lang, modelName: "(router)", mode: "build"}
		m.setStatus()
		for _, want := range c.base {
			if !strings.Contains(m.status, want) {
				t.Errorf("%s sin cuota: falta %q en %q", c.lang, want, m.status)
			}
		}
		if strings.Contains(m.status, "quota:") || strings.Contains(m.status, "cuota:") {
			t.Errorf("%s sin cuota: segmento inventado en %q", c.lang, m.status)
		}
		m.quotaPct = 8
		m.setStatus()
		if !strings.Contains(m.status, c.quotaWant) {
			t.Errorf("%s con cuota: falta %q en %q", c.lang, c.quotaWant, m.status)
		}
	}
}
