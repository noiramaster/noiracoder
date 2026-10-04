package thinclient

import (
	"strings"
	"testing"
)

// 5.2: /level se nota en la barra de estado. Sin nivel (pre-hello) no se
// inventa ningún segmento.
func TestLevelInStatus(t *testing.T) {
	SetCatalog(map[string]string{
		"st_model": "modelo", "st_mode": "modo", "st_session": "sesión",
		"st_level": "nivel",
		"st_quota": "cuota {used}/{total}",
	})
	m := &Model{lang: "es", modelName: "(router)", mode: "build", level: "mid", chatW: 120}
	m.setStatus()
	if !strings.Contains(m.status, "nivel: mid") {
		t.Errorf("falta el nivel en la barra: %q", m.status)
	}
	m.level = "max"
	m.setStatus()
	if !strings.Contains(m.status, "nivel: max") {
		t.Errorf("el cambio de nivel no se refleja: %q", m.status)
	}
	m.level = ""
	m.setStatus()
	if strings.Contains(m.status, "nivel:") || strings.Contains(m.status, "st_level") {
		t.Errorf("sin nivel no debe haber segmento: %q", m.status)
	}
}
func TestSetStatusQuota(t *testing.T) {
	SetCatalog(map[string]string{
		"st_model": "model", "st_mode": "mode", "st_session": "session",
		"st_quota": "quota {used}/{total}",
	})
	cases := []struct {
		lang      string
		base      []string
		quotaWant string
	}{
		{"en", []string{"model: (router)", "mode: build", "session: —"}, "8/100"},
	}
	for _, c := range cases {
		m := &Model{lang: c.lang, modelName: "(router)", mode: "build"}
		m.setStatus()
		for _, want := range c.base {
			if !strings.Contains(m.status, want) {
				t.Errorf("%s sin cuota: falta %q en %q", c.lang, want, m.status)
			}
		}
		if strings.Contains(m.status, "quota ") || strings.Contains(m.status, "cuota ") {
			t.Errorf("%s sin cuota: segmento inventado en %q", c.lang, m.status)
		}
		m.quotaUsed = 8
		m.quotaTotal = 100
		m.setStatus()
		if !strings.Contains(m.status, c.quotaWant) {
			t.Errorf("%s con cuota: falta %q en %q", c.lang, c.quotaWant, m.status)
		}
	}
}
