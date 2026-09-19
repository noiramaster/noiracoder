// HITO 3.6 — textos de la pantalla en los 7 idiomas (en, es, pt, fr, de, it, ar).
// Fuente: ~/.noirarc/prefs.json (la misma que el motor TS). "NoiraCoder" no se traduce.
package thinclient

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

var stringsTable = map[string]map[string]string{
	"en": {
		"prompt_ph": ">\u00a0write your task… (Enter sends, Ctrl+C cancels/quits)", "connected": "> NOIRACODER connected to the engine.",
		"confirm_yes": "[confirm] allowed by the user: %s", "confirm_no": "[confirm] denied by the user.",
		"resumed": "(session resumed: %s, %d turns)", "new_session": "(new session)", "no_sessions": "(no saved sessions)",
		"resume_hint": "use /resume <n> to continue a session", "plan_on": "(Plan mode: read-only, everything is denied)",
		"build_on": "(Build mode: execution with confirmations)", "resume_usage": "usage: /resume <n|id>  (see /sessions)",
		"model_usage": "usage: /model <id>  (current model: %s)", "model_set": "(preferred model: %s)",
		"err_sessions": "[error] sessions: ", "err_resume": "[error] resume: ", "err_model": "[error] model: ",
		"unknown_cmd": "(unknown command, try /help)",
		"help_cmds": "Commands: /sessions [filter] · /resume <n|id> · /new · /plan · /build · /model <id> · /quit",
		"help_keys": "Keys: Enter send · ↑↓ history · Ctrl+C cancels the turn (again to quit)",
		"hints": "Enter send · ↑↓ history · Ctrl+C cancels turn/quits · /help commands",
		"st_model": "model", "st_mode": "mode", "st_session": "session", "st_thinking": "thinking… (%s)",
		"st_turn": "turn running (Ctrl+C cancels)", "st_quota": "quota: %d%%",
		"model_switched": "[model] %s → %s (%s)", "tool_start": "[tool] %s %s", "tool_end": "[tool] %s done%s",
		"tool_end_fail": " (failed)", "mem_line": "[memory:%s] %s", "quota_warn": "[quota] %s",
		"err_motor": "[engine error] ", "err_line": "[error] ", "cancel_line": "[cancel] cancelling turn…",
		"fatal_line": "Check that the engine is still alive.",
		"confirm_q": "Allow this?", "confirm_yn": "[y] yes   [n] no",
	},
	"es": {
		"prompt_ph": "> escribe tu tarea… (Enter envía, Ctrl+C cancela/sale)", "connected": "> NOIRACODER conectado al motor.",
		"confirm_yes": "[confirm] permitido por el usuario: %s", "confirm_no": "[confirm] denegado por el usuario.",
		"resumed": "(sesión reanudada: %s, %d turnos)", "new_session": "(nueva sesión)", "no_sessions": "(sin sesiones guardadas)",
		"resume_hint": "usa /resume <n> para continuar una sesión", "plan_on": "(modo Plan: solo lectura, todo se deniega)",
		"build_on": "(modo Build: ejecución con confirmaciones)", "resume_usage": "uso: /resume <n|id>  (mira /sessions)",
		"model_usage": "uso: /model <id>  (modelo actual: %s)", "model_set": "(modelo preferido: %s)",
		"err_sessions": "[error] sesiones: ", "err_resume": "[error] reanudar: ", "err_model": "[error] modelo: ",
		"unknown_cmd": "(comando desconocido, prueba /help)",
		"help_cmds": "Comandos: /sessions [filtro] · /resume <n|id> · /new · /plan · /build · /model <id> · /quit",
		"help_keys": "Teclas: Enter enviar · ↑↓ historial · Ctrl+C cancela el turno (otra vez para salir)",
		"hints": "Enter enviar · ↑↓ historial · Ctrl+C cancela turno/sale · /help comandos",
		"st_model": "modelo", "st_mode": "modo", "st_session": "sesión", "st_thinking": "pensando… (%s)",
		"st_turn": "turno en curso (Ctrl+C cancela)", "st_quota": "cuota: %d%%",
		"model_switched": "[modelo] %s → %s (%s)", "tool_start": "[herramienta] %s %s", "tool_end": "[herramienta] %s fin%s",
		"tool_end_fail": " (falló)", "mem_line": "[memoria:%s] %s", "quota_warn": "[cuota] %s",
		"err_motor": "[error motor] ", "err_line": "[error] ", "cancel_line": "[cancel] cancelando turno…",
		"fatal_line": "Revisa que el motor siga vivo.",
		"confirm_q": "¿Permites esto?", "confirm_yn": "[y] sí   [n] no",
	},
	"pt": {
		"prompt_ph": "> escreve a tua tarefa… (Enter envia, Ctrl+C cancela/sai)", "connected": "> NOIRACODER ligado ao motor.",
		"confirm_yes": "[confirm] permitido pelo utilizador: %s", "confirm_no": "[confirm] negado pelo utilizador.",
		"resumed": "(sessão retomada: %s, %d turnos)", "new_session": "(nova sessão)", "no_sessions": "(sem sessões guardadas)",
		"resume_hint": "usa /resume <n> para continuar uma sessão", "plan_on": "(modo Plan: só leitura, tudo negado)",
		"build_on": "(modo Build: execução com confirmações)", "resume_usage": "uso: /resume <n|id>  (vê /sessions)",
		"model_usage": "uso: /model <id>  (modelo atual: %s)", "model_set": "(modelo preferido: %s)",
		"err_sessions": "[erro] sessões: ", "err_resume": "[erro] retomar: ", "err_model": "[erro] modelo: ",
		"unknown_cmd": "(comando desconhecido, tenta /help)",
		"help_cmds": "Comandos: /sessions [filtro] · /resume <n|id> · /new · /plan · /build · /model <id> · /quit",
		"help_keys": "Teclas: Enter enviar · ↑↓ histórico · Ctrl+C cancela o turno (outra vez para sair)",
		"hints": "Enter enviar · ↑↓ histórico · Ctrl+C cancela turno/sai · /help comandos",
		"st_model": "modelo", "st_mode": "modo", "st_session": "sessão", "st_thinking": "a pensar… (%s)",
		"st_turn": "turno em curso (Ctrl+C cancela)", "st_quota": "cota: %d%%",
		"model_switched": "[modelo] %s → %s (%s)", "tool_start": "[ferramenta] %s %s", "tool_end": "[ferramenta] %s fim%s",
		"tool_end_fail": " (falhou)", "mem_line": "[memória:%s] %s", "quota_warn": "[cota] %s",
		"err_motor": "[erro motor] ", "err_line": "[erro] ", "cancel_line": "[cancel] a cancelar turno…",
		"fatal_line": "Verifica que o motor continua vivo.",
		"confirm_q": "Permites isto?", "confirm_yn": "[y] sim   [n] não",
	},
	"fr": {
		"prompt_ph": "> écris ta tâche… (Entrée envoie, Ctrl+C annule/quitte)", "connected": "> NOIRACODER connecté au moteur.",
		"confirm_yes": "[confirm] autorisé par l'utilisateur : %s", "confirm_no": "[confirm] refusé par l'utilisateur.",
		"resumed": "(session reprise : %s, %d tours)", "new_session": "(nouvelle session)", "no_sessions": "(aucune session enregistrée)",
		"resume_hint": "utilise /resume <n> pour continuer une session", "plan_on": "(mode Plan : lecture seule, tout est refusé)",
		"build_on": "(mode Build : exécution avec confirmations)", "resume_usage": "usage : /resume <n|id>  (voir /sessions)",
		"model_usage": "usage : /model <id>  (modèle actuel : %s)", "model_set": "(modèle préféré : %s)",
		"err_sessions": "[erreur] sessions : ", "err_resume": "[erreur] reprise : ", "err_model": "[erreur] modèle : ",
		"unknown_cmd": "(commande inconnue, essaie /help)",
		"help_cmds": "Commandes : /sessions [filtre] · /resume <n|id> · /new · /plan · /build · /model <id> · /quit",
		"help_keys": "Touches : Entrée envoyer · ↑↓ historique · Ctrl+C annule le tour (encore pour quitter)",
		"hints": "Entrée envoyer · ↑↓ historique · Ctrl+C annule/quitte · /help commandes",
		"st_model": "modèle", "st_mode": "mode", "st_session": "session", "st_thinking": "réflexion… (%s)",
		"st_turn": "tour en cours (Ctrl+C annule)", "st_quota": "quota : %d%%",
		"model_switched": "[modèle] %s → %s (%s)", "tool_start": "[outil] %s %s", "tool_end": "[outil] %s fin%s",
		"tool_end_fail": " (échoué)", "mem_line": "[mémoire:%s] %s", "quota_warn": "[quota] %s",
		"err_motor": "[erreur moteur] ", "err_line": "[erreur] ", "cancel_line": "[cancel] annulation du tour…",
		"fatal_line": "Vérifie que le moteur est toujours vivant.",
		"confirm_q": "Autoriser ceci ?", "confirm_yn": "[y] oui   [n] non",
	},
	"de": {
		"prompt_ph": "> Aufgabe schreiben… (Enter sendet, Strg+C bricht ab/beendet)", "connected": "> NOIRACODER mit der Engine verbunden.",
		"confirm_yes": "[confirm] vom Benutzer erlaubt: %s", "confirm_no": "[confirm] vom Benutzer verweigert.",
		"resumed": "(Sitzung fortgesetzt: %s, %d Züge)", "new_session": "(neue Sitzung)", "no_sessions": "(keine gespeicherten Sitzungen)",
		"resume_hint": "nutze /resume <n> um fortzufahren", "plan_on": "(Plan-Modus: nur lesen, alles verweigert)",
		"build_on": "(Build-Modus: Ausführung mit Bestätigungen)", "resume_usage": "Nutzung: /resume <n|id>  (siehe /sessions)",
		"model_usage": "Nutzung: /model <id>  (aktuelles Modell: %s)", "model_set": "(bevorzugtes Modell: %s)",
		"err_sessions": "[Fehler] Sitzungen: ", "err_resume": "[Fehler] Fortsetzen: ", "err_model": "[Fehler] Modell: ",
		"unknown_cmd": "(unbekannter Befehl, versuche /help)",
		"help_cmds": "Befehle: /sessions [Filter] · /resume <n|id> · /new · /plan · /build · /model <id> · /quit",
		"help_keys": "Tasten: Enter senden · ↑↓ Verlauf · Strg+C bricht den Zug ab (nochmal zum Beenden)",
		"hints": "Enter senden · ↑↓ Verlauf · Strg+C Abbruch/Ende · /help Befehle",
		"st_model": "Modell", "st_mode": "Modus", "st_session": "Sitzung", "st_thinking": "denke… (%s)",
		"st_turn": "Zug läuft (Strg+C bricht ab)", "st_quota": "Quote: %d%%",
		"model_switched": "[Modell] %s → %s (%s)", "tool_start": "[Tool] %s %s", "tool_end": "[Tool] %s fertig%s",
		"tool_end_fail": " (fehlgeschlagen)", "mem_line": "[Memory:%s] %s", "quota_warn": "[Quote] %s",
		"err_motor": "[Engine-Fehler] ", "err_line": "[Fehler] ", "cancel_line": "[cancel] breche Zug ab…",
		"fatal_line": "Prüfe, ob die Engine noch lebt.",
		"confirm_q": "Dies erlauben?", "confirm_yn": "[y] ja   [n] nein",
	},
	"it": {
		"prompt_ph": "> scrivi il tuo compito… (Invio invia, Ctrl+C annulla/esce)", "connected": "> NOIRACODER connesso al motore.",
		"confirm_yes": "[confirm] consentito dall'utente: %s", "confirm_no": "[confirm] negato dall'utente.",
		"resumed": "(sessione ripresa: %s, %d turni)", "new_session": "(nuova sessione)", "no_sessions": "(nessuna sessione salvata)",
		"resume_hint": "usa /resume <n> per continuare una sessione", "plan_on": "(modalità Plan: sola lettura, tutto negato)",
		"build_on": "(modalità Build: esecuzione con conferme)", "resume_usage": "uso: /resume <n|id>  (vedi /sessions)",
		"model_usage": "uso: /model <id>  (modello attuale: %s)", "model_set": "(modello preferito: %s)",
		"err_sessions": "[errore] sessioni: ", "err_resume": "[errore] ripresa: ", "err_model": "[errore] modello: ",
		"unknown_cmd": "(comando sconosciuto, prova /help)",
		"help_cmds": "Comandi: /sessions [filtro] · /resume <n|id> · /new · /plan · /build · /model <id> · /quit",
		"help_keys": "Tasti: Invio invia · ↑↓ cronologia · Ctrl+C annulla il turno (di nuovo per uscire)",
		"hints": "Invio invia · ↑↓ cronologia · Ctrl+C annulla/esce · /help comandi",
		"st_model": "modello", "st_mode": "modalità", "st_session": "sessione", "st_thinking": "penso… (%s)",
		"st_turn": "turno in corso (Ctrl+C annulla)", "st_quota": "quota: %d%%",
		"model_switched": "[modello] %s → %s (%s)", "tool_start": "[strumento] %s %s", "tool_end": "[strumento] %s fine%s",
		"tool_end_fail": " (fallito)", "mem_line": "[memoria:%s] %s", "quota_warn": "[quota] %s",
		"err_motor": "[errore motore] ", "err_line": "[errore] ", "cancel_line": "[cancel] annullo il turno…",
		"fatal_line": "Verifica che il motore sia ancora vivo.",
		"confirm_q": "Consentire questo?", "confirm_yn": "[y] sì   [n] no",
	},
	"ar": {
		"prompt_ph": "> اكتب مهمتك… (Enter للإرسال، Ctrl+C للإلغاء/الخروج)", "connected": "> NOIRACODER متصل بالمحرك.",
		"confirm_yes": "[تأكيد] سمح به المستخدم: %s", "confirm_no": "[تأكيد] رفضه المستخدم.",
		"resumed": "(تم استئناف الجلسة: %s، %d أدوار)", "new_session": "(جلسة جديدة)", "no_sessions": "(لا جلسات محفوظة)",
		"resume_hint": "استخدم /resume <n> لمتابعة جلسة", "plan_on": "(وضع Plan: قراءة فقط، كل شيء مرفوض)",
		"build_on": "(وضع Build: تنفيذ مع تأكيدات)", "resume_usage": "الاستخدام: /resume <n|id>  (انظر /sessions)",
		"model_usage": "الاستخدام: /model <id>  (النموذج الحالي: %s)", "model_set": "(النموذج المفضل: %s)",
		"err_sessions": "[خطأ] الجلسات: ", "err_resume": "[خطأ] الاستئناف: ", "err_model": "[خطأ] النموذج: ",
		"unknown_cmd": "(أمر غير معروف، جرّب /help)",
		"help_cmds": "الأوامر: /sessions [تصفية] · /resume <n|id> · /new · /plan · /build · /model <id> · /quit",
		"help_keys": "المفاتيح: Enter إرسال · ↑↓ السجل · Ctrl+C يلغي الدور (مرة أخرى للخروج)",
		"hints": "Enter إرسال · ↑↓ السجل · Ctrl+C إلغاء/خروج · /help للأوامر",
		"st_model": "النموذج", "st_mode": "الوضع", "st_session": "الجلسة", "st_thinking": "أفكر… (%s)",
		"st_turn": "دور جارٍ (Ctrl+C يلغي)", "st_quota": "الحصة: %d%%",
		"model_switched": "[نموذج] %s → %s (%s)", "tool_start": "[أداة] %s %s", "tool_end": "[أداة] %s انتهت%s",
		"tool_end_fail": " (فشلت)", "mem_line": "[ذاكرة:%s] %s", "quota_warn": "[حصة] %s",
		"err_motor": "[خطأ المحرك] ", "err_line": "[خطأ] ", "cancel_line": "[إلغاء] جارٍ إلغاء الدور…",
		"fatal_line": "تحقق من أن المحرك ما زال يعمل.",
		"confirm_q": "هل تسمح بهذا؟", "confirm_yn": "[y] نعم   [n] لا",
	},
}

// lang detecta el idioma: prefs.json del motor, defecto "en".
func detectLang() string {
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
	if _, ok := stringsTable[v.Language]; ok {
		return v.Language
	}
	return "en"
}

// T devuelve el texto en el idioma activo (fallback inglés).
func T(lang, key string, args ...any) string {
	dict := stringsTable[lang]
	if dict == nil {
		dict = stringsTable["en"]
	}
	s, ok := dict[key]
	if !ok {
		s = stringsTable["en"][key]
	}
	if s == "" {
		return key
	}
	if len(args) > 0 {
		return fmt.Sprintf(s, args...)
	}
	return s
}
