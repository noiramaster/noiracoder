package thinclient

// M2: lógica del panel sin pty (motor falso httptest). Tab/Enter/CtrlB,
// filtro, renombrar, fijar, borrar-estado, /mouse, /copy van por aquí;
// el pty solo verifica entrega de teclas y pintado.

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	tea "github.com/charmbracelet/bubbletea"
	zone "github.com/lrstanley/bubblezone"
)

func fakeMotor() *httptest.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"ok":true,"protocol":2,"engine":"test"}`))
	})
	mux.HandleFunc("/v1/i18n", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"lang":"es","strings":{"connected":"listo","hints":"h","help_cmds":"cmds","help_keys":"keys","help_title":"ayuda","help_section_cmds":"comandos","help_section_keys":"teclado","help_footer":"footer","boot_hint":"boot","err_sessions":"[error] sesiones: ","err_resume":"[error] reanudar: ","err_model":"[error] modelo: ","no_sessions":"(vacío)","resume_hint":"rh","resume_usage":"ru","new_session":"(nueva)","plan_on":"plan","build_on":"build","model_usage":"uso {model}","model_set":"ok {model}","unknown_cmd":"?","st_model":"modelo","st_mode":"modo","st_session":"sesión","session_row":"{mark}{n} {name}","session_row__other":"{mark}{n} {name}","resumed":"r {name}","resumed__other":"r {name}","confirm_q":"?","confirm_yn":"yn","confirm_result":"[{reason}]","confirm_yes":"sí {detail}","confirm_no":"no","cancel_line":"c","err_motor":"[motor] ","err_line":"[e] ","err_model":"[m] ","fatal_line":"f","prompt_ph":"ph","st_thinking":"p {model}","st_quota":"q {pct}%","st_turn":"t","model_switched":"{from}>{to}","tool_start":"{name}","tool_end":"{name}","tool_end_fail":"!","mem_line":"{level}","quota_warn":"{notice}","mem_line":"m","panel_new":"+ Nueva","panel_all":"todas","panel_project":"proyecto","panel_hint":"h","mouse_hint":"mh","mouse_usage":"mu","copy_ok":"ok {n}","title_usage":"tu","title_set":"ts","lang_usage":"lu","lang_set":"ls","lang_auto":"la","lang_answer_set":"las","lang_current":"lc","panel_hint_esc":"esc","err_health_unreadable":"hu","err_motor_not_ok":"mno","err_protocol_mismatch":"pm","err_turn_active":"ta","err_turn_rejected":"tr","err_confirm_rejected":"cr","err_sessions_status":"ss","err_session_status":"se","err_model_status":"ms","err_screen_connected":"sc","err_events_status":"es","err_stream_cut":"scu","err_stream_closed":"scl","err_session_not_found":"snf","err_field_required":"fr","err_no_turn_id":"nt","err_client_connected":"cc","err_turn_in_progress":"tip","err_unauthorized":"un","err_not_found":"nf","err_request":"rq","session_row__one":"{mark}{n} {name}","resumed__one":"r {name}"}}`))
	})
	sess := []map[string]any{
		{"id": "id-a", "nombre": "Alpha", "updatedAt": "2026-09-21T10:00:00Z", "rel": "hace 1 h", "grupo": "Hoy", "fija": false, "activa": false, "turnos": 2},
		{"id": "id-b", "nombre": "Beta", "updatedAt": "2026-09-20T10:00:00Z", "rel": "ayer", "grupo": "Ayer", "fija": false, "activa": false, "turnos": 4},
	}
	mux.HandleFunc("/v1/sessions", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case "GET":
			json.NewEncoder(w).Encode(map[string]any{"sesiones": sess})
		case "POST":
			json.NewEncoder(w).Encode(map[string]any{"ok": true, "id": "id-new", "nombre": "Nueva"})
		default:
			w.WriteHeader(404)
		}
	})
	mux.HandleFunc("/v1/sessions/", func(w http.ResponseWriter, r *http.Request) {
		id := strings.TrimPrefix(r.URL.Path, "/v1/sessions/")
		switch r.Method {
		case "GET":
			for _, s := range sess {
				if s["id"] == id {
					json.NewEncoder(w).Encode(map[string]any{"id": id, "nombre": s["nombre"],
						"turnos": []any{map[string]any{"role": "user", "content": "hola"}}})
					return
				}
			}
			w.WriteHeader(404)
		case "PATCH":
			var b map[string]any
			json.NewDecoder(r.Body).Decode(&b)
			for _, s := range sess {
				if s["id"] == id {
					if n, ok := b["nombre"].(string); ok && n != "" {
						s["nombre"] = n
					}
					if f, ok := b["fija"].(bool); ok {
						s["fija"] = f
					}
					json.NewEncoder(w).Encode(map[string]any{"ok": true, "id": id, "nombre": s["nombre"], "fija": s["fija"]})
					return
				}
			}
			w.WriteHeader(404)
		case "DELETE":
			json.NewEncoder(w).Encode(map[string]any{"ok": true, "id": id})
		default:
			w.WriteHeader(404)
		}
	})
	mux.HandleFunc("/v1/ui", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{"panelOpen": true})
	})
	mux.HandleFunc("/v1/model", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"ok":true}`))
	})
	mux.HandleFunc("/v1/title", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"ok":true,"mode":"off","msg":"t off"}`))
	})
	return httptest.NewServer(mux)
}

func testModel(t *testing.T) (*Model, func()) {
	t.Helper()
	zone.NewGlobal()
	t.Setenv("NOIRARC_HOME", t.TempDir())
	srv := fakeMotor()
	c := NewClient("0", "x")
	c.Base = srv.URL
	c.Lang = "es"
	cat, err := c.I18n("es")
	if err != nil {
		t.Fatalf("i18n: %v", err)
	}
	SetCatalog(cat)
	m := New(c)
	m.width, m.height, m.chatW = 100, 30, 70
	m.relayout()
	return m, srv.Close
}

func upd(m *Model, msg tea.Msg) *Model {
	nm, _ := m.Update(msg)
	return nm.(*Model)
}

func to(m *Model, gen int) *Model {
	nm, _ := m.panelTimeout(gen)
	return nm.(*Model)
}

func keyPress(t tea.KeyType, runes ...rune) tea.KeyMsg {
	return tea.KeyMsg{Type: t, Runes: runes}
}

func TestPanelFocusEnter(t *testing.T) {
	m, done := testModel(t)
	defer done()
	m.onEvent(Event{Name: "hello", Data: map[string]any{}})
	if len(m.panel.Items) != 2 {
		t.Fatalf("items=%d", len(m.panel.Items))
	}
	m = upd(m, keyPress(tea.KeyTab))
	if !m.panel.Focus {
		t.Fatalf("Tab no enfoca")
	}
	m = upd(m, keyPress(tea.KeyEnter))
	if m.sessionID != "id-a" {
		t.Fatalf("Enter no abre: sessionID=%q", m.sessionID)
	}
	if m.sessName != "Alpha" {
		t.Fatalf("nombre=%q", m.sessName)
	}
}

func TestPanelCtrlB(t *testing.T) {
	m, done := testModel(t)
	defer done()
	m.onEvent(Event{Name: "hello", Data: map[string]any{}})
	if !m.panel.Open {
		t.Fatalf("panel debería abrir por defecto")
	}
	m = upd(m, keyPress(tea.KeyCtrlB))
	if m.panel.Open {
		t.Fatalf("Ctrl+B no oculta")
	}
	m = upd(m, keyPress(tea.KeyCtrlB))
	if !m.panel.Open {
		t.Fatalf("Ctrl+B no muestra")
	}
}

func TestPanelFilterRenamePinDelete(t *testing.T) {
	m, done := testModel(t)
	defer done()
	m.onEvent(Event{Name: "hello", Data: map[string]any{}})
	m = upd(m, keyPress(tea.KeyTab)) // foco
	m = upd(m, keyPress(tea.KeyRunes, 'b', 'e'))
	if m.panel.Filter != "be" {
		t.Fatalf("filtro=%q", m.panel.Filter)
	}
	if len(m.panelFiltered()) != 1 || m.panelFiltered()[0].ID != "id-b" {
		t.Fatalf("filtrado mal")
	}
	// renombrar: Esc (limpia) + ↓ a Beta + 'r' sola (pendiente) + timeout
	m = upd(m, keyPress(tea.KeyEsc))
	m = upd(m, keyPress(tea.KeyTab))
	m = upd(m, keyPress(tea.KeyDown))
	m = upd(m, keyPress(tea.KeyRunes, 'r'))
	if m.renaming {
		t.Fatalf("r no debe actuar de inmediato (espera 500 ms)")
	}
	m = to(m, m.panel.pendingGen)
	if !m.renaming {
		t.Fatalf("r+timeout no edita")
	}
	m.input.SetValue("Beta2")
	m = upd(m, keyPress(tea.KeyEnter))
	if m.renaming {
		t.Fatalf("Enter no confirma rename")
	}
	m.refreshPanel()
	foundBeta := false
	for _, it := range m.panel.Items {
		if it.ID == "id-b" && it.Nombre == "Beta2" {
			foundBeta = true
		}
	}
	if !foundBeta {
		t.Fatalf("rename no aplicado: %+v", m.panel.Items)
	}
	// "dos" rápido: d pendiente + o,s lo convierten en texto (sin diálogo)
	m2, done2 := testModel(t)
	defer done2()
	m2.onEvent(Event{Name: "hello", Data: map[string]any{}})
	m2 = upd(m2, keyPress(tea.KeyTab))
	for _, r := range []rune{'d', 'o', 's'} {
		m2 = upd(m2, keyPress(tea.KeyRunes, r))
	}
	if m2.confirm != nil {
		t.Fatalf("'dos' no debe abrir diálogo")
	}
	if m2.panel.Filter != "dos" {
		t.Fatalf("filtro=%q", m2.panel.Filter)
	}
	// 'd' sola + timeout sí confirma
	m2.panel.Filter = ""
	m2 = upd(m2, keyPress(tea.KeyRunes, 'd'))
	m2 = to(m2, m2.panel.pendingGen)
	if m2.confirm == nil || m2.confirm.kind != "delsess" {
		t.Fatalf("d+timeout no confirma")
	}
	m2 = upd(m2, keyPress(tea.KeyRunes, 'n'))
	if m2.confirm != nil {
		t.Fatalf("n no deniega")
	}
	// fijar: 'f' + timeout actúa sobre lo visible (Beta filtrada)
	m = upd(m, keyPress(tea.KeyRunes, 'f'))
	m = to(m, m.panel.pendingGen)
	m.refreshPanel()
	found := false
	for _, it := range m.panel.Items {
		if it.ID == "id-b" && it.Fija {
			found = true
		}
	}
	if !found {
		t.Fatalf("pin no aplicado: %+v", m.panel.Items)
	}
	// borrar pide confirmación (no borra solo)
	m = upd(m, keyPress(tea.KeyRunes, 'd'))
	m = to(m, m.panel.pendingGen)
	if m.confirm == nil || m.confirm.kind != "delsess" {
		t.Fatalf("d no confirma")
	}
	m = upd(m, keyPress(tea.KeyRunes, 'n'))
	if m.confirm != nil {
		t.Fatalf("n no deniega")
	}
}

func TestPanelNav(t *testing.T) {
	m, done := testModel(t)
	defer done()
	m.onEvent(Event{Name: "hello", Data: map[string]any{}})
	m = upd(m, keyPress(tea.KeyTab))
	if m.panel.Idx != 0 {
		t.Fatalf("idx inicial=%d", m.panel.Idx)
	}
	m = upd(m, keyPress(tea.KeyDown))
	if m.panel.Idx != 1 {
		t.Fatalf("down=%d", m.panel.Idx)
	}
	m = upd(m, keyPress(tea.KeyDown))
	m = upd(m, keyPress(tea.KeyDown))
	if m.panel.Idx != 1 {
		t.Fatalf("down debe topar al final=%d", m.panel.Idx)
	}
	m = upd(m, keyPress(tea.KeyUp))
	if m.panel.Idx != 0 {
		t.Fatalf("up=%d", m.panel.Idx)
	}
}

func TestPanelMouseCopy(t *testing.T) {
	m, done := testModel(t)
	defer done()
	m.onEvent(Event{Name: "hello", Data: map[string]any{}})
	if !m.mouseOn {
		t.Fatalf("ratón debería ir por defecto")
	}
	if m.handleCommand("/mouse off") {
		// comando reconocido
	}
	if m.mouseOn {
		t.Fatalf("/mouse off no apaga")
	}
	// /copy sin respuestas: no rompe ni toca el portapapeles
	m.messages = nil
	if m.handleCommand("/copy") {
		// ok
	}
}
