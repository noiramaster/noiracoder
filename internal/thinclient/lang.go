// HITO 3.6 + M1.1 — textos de la pantalla: la FUENTE ÚNICA vive en el motor
// TS (src/i18n/screen.ts) y la Go los pide por GET /v1/i18n?lang=.
// Aquí NO hay diccionarios: solo detección de idioma (prefs.json local),
// el catálogo servido en memoria y sustitución de {vars}.
// "NoiraCoder" y los nombres /cmd no se traducen.
package thinclient

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

// screenCatalog guarda las cadenas servidas por el motor (SetCatalog).
var screenCatalog = map[string]string{}

// SetCatalog instala las cadenas del idioma activo (las trae main vía /v1/i18n).
func SetCatalog(m map[string]string) {
	if m == nil {
		m = map[string]string{}
	}
	screenCatalog = m
	if s, ok := m["truncated_suffix"]; ok && s != "" {
		truncatedSuffix = s
	} else {
		truncatedSuffix = "…[truncated]"
	}
}

// DetectLang lee el idioma de prefs.json (la misma que el motor). Sin
// prefs o idioma desconocido: "en". El motor aplica exacto → base → en.
func DetectLang() string {
	home := os.Getenv("NOIRARC_HOME")
	if home == "" {
		if h, err := os.UserHomeDir(); err == nil {
			home = h
		} else {
			return "en"
		}
	}
	b, err := os.ReadFile(filepath.Join(home, ".noirarc", "prefs.json"))
	if err != nil {
		return "en"
	}
	var v struct {
		Language string `json:"language"`
	}
	if err := json.Unmarshal(b, &v); err != nil {
		return "en"
	}
	if v.Language == "" {
		return "en"
	}
	return v.Language
}

// T devuelve la cadena del catálogo servido. Sin clave → la clave
// (visible en el lint de M1.1, nunca silencioso).
func T(lang, key string) string {
	_ = lang // el idioma ya lo resolvió el motor al servir el catálogo
	if s, ok := screenCatalog[key]; ok && s != "" {
		return s
	}
	return key
}

// F sustituye {vars} nombradas. Lo desconocido se deja tal cual.
func F(lang, key string, vars map[string]string) string {
	s := T(lang, key)
	for k, v := range vars {
		s = strings.ReplaceAll(s, "{"+k+"}", v)
	}
	return s
}
