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

// FP elige la forma plural del catálogo (M1.2): clave__categoria, caída a
// __other y a la clave base. Reglas CLDR mínimas para nuestros 7 idiomas
// (el motor hace lo fino con Intl; aquí basta para pintar la fila).
func FP(lang, key string, n int, vars map[string]string) string {
	cat := pluralCategory(lang, n)
	if s, ok := screenCatalog[key+"__"+cat]; ok && s != "" {
		return subst(s, vars)
	}
	if s, ok := screenCatalog[key+"__other"]; ok && s != "" {
		return subst(s, vars)
	}
	return F(lang, key, vars)
}

func subst(s string, vars map[string]string) string {
	for k, v := range vars {
		s = strings.ReplaceAll(s, "{"+k+"}", v)
	}
	return s
}

// pluralCategory: en/es/pt/it/de 1→one; fr 0,1→one; ar 6 formas; resto other.
func pluralCategory(lang string, n int) string {
	base := lang
	for i, c := range base {
		if c == '-' || c == '_' {
			base = base[:i]
			break
		}
	}
	switch base {
	case "ar":
		if n == 0 {
			return "zero"
		}
		if n == 1 {
			return "one"
		}
		if n == 2 {
			return "two"
		}
		if n >= 3 && n <= 10 {
			return "few"
		}
		if n >= 11 && n <= 99 {
			return "many"
		}
		return "other"
	case "fr":
		if n <= 1 {
			return "one"
		}
		return "other"
	case "en", "es", "pt", "it", "de":
		if n == 1 {
			return "one"
		}
		return "other"
	default:
		return "other"
	}
}
