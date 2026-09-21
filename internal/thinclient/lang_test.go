package thinclient

// M1.1 — sin diccionarios en Go: el catálogo lo sirve el motor (SetCatalog).
// Aquí: sustitución {vars}, passthrough de claves ausentes y detección.

import (
	"os"
	"path/filepath"
	"testing"
)

func TestCatalogSubst(t *testing.T) {
	SetCatalog(map[string]string{
		"model_switched": "[model] {from} → {to} ({reason})",
		"st_quota":       "quota: {pct}%",
		"hints":          "Enter send · /help",
	})
	got := F("es", "model_switched", map[string]string{"from": "a", "to": "b", "reason": "quota"})
	if got != "[model] a → b (quota)" {
		t.Errorf("sustitución rota: %q", got)
	}
	got = F("es", "st_quota", map[string]string{"pct": "8"})
	if got != "quota: 8%" {
		t.Errorf("sustitución rota: %q", got)
	}
	// Variable desconocida se deja tal cual (visible, nunca silencioso).
	got = F("es", "st_quota", map[string]string{"otra": "x"})
	if got != "quota: {pct}%" {
		t.Errorf("var desconocida debe quedar: %q", got)
	}
	// Clave ausente se devuelve tal cual (la ve el lint, no se inventa).
	if T("es", "no_existe") != "no_existe" {
		t.Errorf("clave ausente debe devolverse tal cual")
	}
	// Sin catálogo, todo es passthrough (pantalla no arranca: main exige i18n).
	SetCatalog(nil)
	if T("es", "hints") != "hints" {
		t.Errorf("sin catálogo debe pasar la clave")
	}
}

func TestPluralCategory(t *testing.T) {
	cases := []struct {
		lang string
		n    int
		want string
	}{
		{"en", 1, "one"}, {"en", 0, "other"}, {"en", 5, "other"},
		{"es", 1, "one"}, {"es", 2, "other"},
		{"fr", 0, "one"}, {"fr", 1, "one"}, {"fr", 2, "other"},
		{"de", 1, "one"}, {"de", 3, "other"},
		{"ar", 0, "zero"}, {"ar", 1, "one"}, {"ar", 2, "two"},
		{"ar", 5, "few"}, {"ar", 11, "many"}, {"ar", 100, "other"},
		{"xx", 1, "other"},
	}
	for _, c := range cases {
		if got := pluralCategory(c.lang, c.n); got != c.want {
			t.Errorf("plural(%s,%d) = %q, quiero %q", c.lang, c.n, got, c.want)
		}
	}
	// FP cae a __other y a la clave (visible, nunca inventa).
	SetCatalog(map[string]string{"resumed__other": "r({turns})"})
	if got := FP("ar", "resumed", 0, map[string]string{"turns": "0"}); got != "r(0)" {
		t.Errorf("FP fallback other roto: %q", got)
	}
	SetCatalog(nil)
	if got := FP("es", "resumed", 3, map[string]string{"turns": "3"}); got != "resumed" {
		t.Errorf("FP sin catálogo debe pasar la clave: %q", got)
	}
}

func TestDetectLang(t *testing.T) {
	dir := t.TempDir()
	os.Setenv("NOIRARC_HOME", dir)
	defer os.Unsetenv("NOIRARC_HOME")
	if got := DetectLang(); got != "en" {
		t.Errorf("sin prefs debe ser en, fue %s", got)
	}
	os.MkdirAll(filepath.Join(dir, ".noirarc"), 0o755)
	os.WriteFile(filepath.Join(dir, ".noirarc", "prefs.json"), []byte(`{"language":"ar"}`), 0o644)
	if got := DetectLang(); got != "ar" {
		t.Errorf("con prefs ar debe ser ar, fue %s", got)
	}
	// El motor resuelve el fallback (exacto → base → en); aquí pasa el valor.
	os.WriteFile(filepath.Join(dir, ".noirarc", "prefs.json"), []byte(`{"language":"pt-BR"}`), 0o644)
	if got := DetectLang(); got != "pt-BR" {
		t.Errorf("prefs pt-BR debe pasar tal cual (fallback en motor), fue %s", got)
	}
}
