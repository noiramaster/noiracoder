package thinclient

// HITO 3.6 — la tabla está completa en los 7 idiomas y detectLang lee prefs.

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLangTableComplete(t *testing.T) {
	langs := []string{"en", "es", "pt", "fr", "de", "it", "ar"}
	base := map[string]bool{}
	for k := range stringsTable["en"] {
		base[k] = true
	}
	if len(base) < 20 {
		t.Fatalf("tabla EN demasiado pequeña: %d claves", len(base))
	}
	// Cognados legítimos (misma palabra en ambos idiomas), no "sin traducir".
	allowSame := map[string]bool{
		"es:err_line": true, "fr:st_session": true, "fr:st_mode": true,
		"fr:quota_warn": true, "it:st_quota": true, "it:quota_warn": true,
	}
	for _, l := range langs {
		dict, ok := stringsTable[l]
		if !ok {
			t.Errorf("falta idioma %s", l)
			continue
		}
		for k := range base {
			v, ok := dict[k]
			if !ok || v == "" {
				t.Errorf("%s: falta clave %s", l, k)
			}
			if ok && l != "en" && k != "confirm_yn" && !allowSame[l+":"+k] && v == stringsTable["en"][k] {
				t.Errorf("%s: %s idéntica al inglés (sin traducir)", l, k)
			}
		}
	}
	if T("xx", "hints") == "" || T("xx", "hints") != T("en", "hints") {
		t.Errorf("fallback a inglés roto")
	}
	if T("es", "no_existe") != "no_existe" {
		t.Errorf("clave ausente debe devolverse tal cual")
	}
}

func TestDetectLang(t *testing.T) {
	dir := t.TempDir()
	os.Setenv("NOIRARC_HOME", dir)
	defer os.Unsetenv("NOIRARC_HOME")
	if got := detectLang(); got != "en" {
		t.Errorf("sin prefs debe ser en, fue %s", got)
	}
	os.MkdirAll(filepath.Join(dir, ".noirarc"), 0o755)
	os.WriteFile(filepath.Join(dir, ".noirarc", "prefs.json"), []byte(`{"language":"ar"}`), 0o644)
	if got := detectLang(); got != "ar" {
		t.Errorf("con prefs ar debe ser ar, fue %s", got)
	}
	os.WriteFile(filepath.Join(dir, ".noirarc", "prefs.json"), []byte(`{"language":"xx"}`), 0o644)
	if got := detectLang(); got != "en" {
		t.Errorf("idioma inválido debe caer a en, fue %s", got)
	}
}
