// Package thinclient — pantalla Go como CLIENTE FINO del motor TS.
// Solo pinta y recoge teclas. No importa (ni enlaza) herramientas,
// permisos, proveedores ni sesiones del motor antiguo.
//
// M1.1: sin diccionarios. Las cadenas vienen del motor (GET /v1/i18n) y los
// errores usan claves del catálogo (F). Antes de cargar el catálogo solo
// hay diagnósticos por stderr (los ve el wrapper, nunca la pantalla).
package thinclient

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// PROTOCOL es la versión de docs/PROTOCOL.md que habla este cliente (v2: +/v1/i18n).
const PROTOCOL = "2"

// Event es un evento SSE del motor.
type Event struct {
	Name string
	Data map[string]any
}

// Client habla con el motor thin en 127.0.0.1.
type Client struct {
	Base  string
	Token string
	Lang  string
	http  *http.Client
}

// NewClient construye el cliente desde entorno (puerto/token del wrapper).
func NewClient(port, token string) *Client {
	return &Client{
		Base:  "http://127.0.0.1:" + port,
		Token: token,
		http:  &http.Client{Timeout: 30 * time.Second},
	}
}

// I18n trae el catálogo de pantalla del motor (M1.1, fuente única).
func (c *Client) I18n(lang string) (map[string]string, error) {
	st, b, err := c.req("GET", "/v1/i18n?lang="+url.QueryEscape(lang), nil)
	if err != nil {
		return nil, err
	}
	if st != 200 {
		return nil, fmt.Errorf("i18n %d: %s", st, strings.TrimSpace(string(b)))
	}
	var v struct {
		Lang    string            `json:"lang"`
		Strings map[string]string `json:"strings"`
	}
	if err := json.Unmarshal(b, &v); err != nil {
		return nil, err
	}
	if len(v.Strings) == 0 {
		return nil, fmt.Errorf("i18n: catálogo vacío")
	}
	return v.Strings, nil
}

func (c *Client) req(method, path string, body any) (int, []byte, error) {
	var r io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return 0, nil, err
		}
		r = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, c.Base+path, r)
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.Token)
	req.Header.Set("X-Noira-Protocol", PROTOCOL)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer resp.Body.Close()
	b, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return resp.StatusCode, nil, err
	}
	return resp.StatusCode, b, nil
}

// Health verifica motor vivo + versión de protocolo.
func (c *Client) Health() (string, error) {
	req, err := http.NewRequest("GET", c.Base+"/health", nil)
	if err != nil {
		return "", err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	var v struct {
		OK       bool   `json:"ok"`
		Protocol int    `json:"protocol"`
		Engine   string `json:"engine"`
	}
	if err := json.Unmarshal(b, &v); err != nil {
		return "", fmt.Errorf("%s: %w", T(c.Lang, "err_health_unreadable"), err)
	}
	if !v.OK {
		return "", fmt.Errorf("%s", T(c.Lang, "err_motor_not_ok"))
	}
	if fmt.Sprint(v.Protocol) != PROTOCOL {
		return "", fmt.Errorf("%s", F(c.Lang, "err_protocol_mismatch",
			map[string]string{"motor": fmt.Sprint(v.Protocol), "client": PROTOCOL}))
	}
	return v.Engine, nil
}

// Turn abre un turno. Devuelve turnId + sessionId.
func (c *Client) Turn(sessionID, message, mode string) (turnID, sessID string, err error) {
	st, b, err := c.req("POST", "/v1/turn", map[string]any{
		"sessionId": sessionID, "message": message, "mode": mode,
	})
	if err != nil {
		return "", "", err
	}
	if st == 409 {
		return "", "", fmt.Errorf("%s", T(c.Lang, "err_turn_active"))
	}
	if st != 202 {
		return "", "", fmt.Errorf("%s", F(c.Lang, "err_turn_rejected",
			map[string]string{"status": fmt.Sprint(st), "body": strings.TrimSpace(string(b))}))
	}
	var v struct {
		TurnID    string `json:"turnId"`
		SessionID string `json:"sessionId"`
	}
	if err := json.Unmarshal(b, &v); err != nil {
		return "", "", err
	}
	return v.TurnID, v.SessionID, nil
}

// Confirm responde a una petición de confirmación.
func (c *Client) Confirm(confirmID string, approved bool) error {
	st, b, err := c.req("POST", "/v1/confirm", map[string]any{
		"confirmId": confirmID, "aprobado": approved,
	})
	if err != nil {
		return err
	}
	if st != 200 {
		return fmt.Errorf("%s", F(c.Lang, "err_confirm_rejected",
			map[string]string{"status": fmt.Sprint(st), "body": strings.TrimSpace(string(b))}))
	}
	return nil
}

// H10: Options responde a una petición de opciones seleccionables.
func (c *Client) Options(optionsID string, choice string) error {
	st, b, err := c.req("POST", "/v1/options", map[string]any{
		"optionsId": optionsID, "choice": choice,
	})
	if err != nil {
		return err
	}
	if st != 200 {
		return fmt.Errorf("options error %d: %s", st, strings.TrimSpace(string(b)))
	}
	return nil
}

// Cancel cancela el turno en curso.
func (c *Client) Cancel(turnID string) error {
	_, _, err := c.req("POST", "/v1/cancel", map[string]any{"turnId": turnID})
	return err
}

// H8: Connections devuelve el estado de conexión de cada proveedor.
type ProviderConnection struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Note      string `json:"note"`
	KeyURL    string `json:"keyUrl"`
	Connected bool   `json:"connected"`
}

func (c *Client) Connections() ([]ProviderConnection, error) {
	st, b, err := c.req("GET", "/v1/connections", nil)
	if err != nil {
		return nil, err
	}
	if st != 200 {
		return nil, fmt.Errorf("connections %d", st)
	}
	var resp struct {
		Providers []ProviderConnection `json:"providers"`
	}
	if err := json.Unmarshal(b, &resp); err != nil {
		return nil, err
	}
	return resp.Providers, nil
}

// H8: Connect valida y almacena una credencial para un servicio.
func (c *Client) Connect(serviceID string, value string) (bool, string) {
	st, b, err := c.req("POST", "/v1/connect", map[string]any{
		"serviceId": serviceID, "value": value,
	})
	if err != nil {
		return false, err.Error()
	}
	var resp struct {
		Ok    bool   `json:"ok"`
		Error string `json:"error,omitempty"`
	}
	if err := json.Unmarshal(b, &resp); err != nil {
		return false, string(b)
	}
	if st != 200 {
		return false, resp.Error
	}
	return resp.Ok, ""
}

// ZZ: Level cambia el nivel en caliente (POST /v1/level).
func (c *Client) Level(level string) (string, string) {
	st, b, err := c.req("POST", "/v1/level", map[string]any{
		"level": level,
	})
	if err != nil {
		return "", err.Error()
	}
	var resp struct {
		Ok    bool   `json:"ok"`
		Level string `json:"level"`
		Error string `json:"error,omitempty"`
	}
	if err := json.Unmarshal(b, &resp); err != nil {
		return "", string(b)
	}
	if st != 200 || !resp.Ok {
		return "", resp.Error
	}
	return resp.Level, ""
}

// GG: Deploy publica vía deployTool del motor (con su confirmación vía SSE).
func (c *Client) Deploy(target string) (bool, string) {
	st, b, err := c.req("POST", "/v1/deploy", map[string]any{
		"target": target,
	})
	if err != nil {
		return false, err.Error()
	}
	var resp struct {
		Ok     bool   `json:"ok"`
		Output string `json:"output"`
		Error  string `json:"error,omitempty"`
	}
	if err := json.Unmarshal(b, &resp); err != nil {
		return false, string(b)
	}
	if st != 200 {
		return false, resp.Error
	}
	return resp.Ok, resp.Output
}

// GG: Logout borra las claves del disco (el cliente confirma antes).
func (c *Client) Logout() (bool, string) {
	st, b, err := c.req("POST", "/v1/logout", nil)
	if err != nil {
		return false, err.Error()
	}
	var resp struct {
		Ok      bool   `json:"ok"`
		Deleted bool   `json:"deleted"`
		Msg     string `json:"msg"`
		Error   string `json:"error,omitempty"`
	}
	if err := json.Unmarshal(b, &resp); err != nil {
		return false, string(b)
	}
	if st != 200 {
		return false, resp.Error
	}
	return resp.Ok, resp.Msg
}

// HH: Login lanza el OAuth OpenRouter en el servidor (abre el navegador).
func (c *Client) Login() (bool, string) {
	st, b, err := c.req("POST", "/v1/login", nil)
	if err != nil {
		return false, err.Error()
	}
	var resp struct {
		Ok    bool   `json:"ok"`
		Msg   string `json:"msg"`
		Error string `json:"error,omitempty"`
	}
	if err := json.Unmarshal(b, &resp); err != nil {
		return false, string(b)
	}
	if st != 200 {
		return false, resp.Error
	}
	return resp.Ok, resp.Msg
}

// H9: Explain devuelve el resumen del último turno de una sesión.
type ExplainResult struct {
	Pregunta string `json:"pregunta"`
	Respuesta string `json:"respuesta"`
	Turnos   int    `json:"turnos"`
}

func (c *Client) Explain(sessionID string) (*ExplainResult, error) {
	st, b, err := c.req("POST", "/v1/explain", map[string]any{"sessionId": sessionID})
	if err != nil {
		return nil, err
	}
	if st != 200 {
		return nil, fmt.Errorf("explain %d", st)
	}
	var resp ExplainResult
	if err := json.Unmarshal(b, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// Session resume de /v1/sessions.
type Session struct {
	ID     string `json:"id"`
	Nombre string `json:"nombre"`
	Turnos int    `json:"turnos"`
	Rel    string `json:"rel"`
	Grupo  string `json:"grupo"`
	Fija   bool   `json:"fija"`
	Activa bool   `json:"activa"`
}

// Sessions lista sesiones persistidas (sobreviven a reinicios).
func (c *Client) Sessions() ([]Session, error) {
	return c.SessionsExt(false)
}

// SessionsExt lista del proyecto o de todos (?all=1, M2.1).
func (c *Client) SessionsExt(all bool) ([]Session, error) {
	path := "/v1/sessions"
	if all {
		path = "/v1/sessions?all=1"
	}
	st, b, err := c.req("GET", path, nil)
	if err != nil {
		return nil, err
	}
	if st != 200 {
		return nil, fmt.Errorf("%s", F(c.Lang, "err_sessions_status",
			map[string]string{"status": fmt.Sprint(st)}))
	}
	var v struct {
		Sesiones []Session `json:"sesiones"`
	}
	if err := json.Unmarshal(b, &v); err != nil {
		return nil, err
	}
	return v.Sesiones, nil
}

// PatchSession renombra y/o fija (M2.2). Devuelve nombre + fija.
func (c *Client) PatchSession(id, nombre string, fija *bool) (string, bool, error) {
	body := map[string]any{}
	if nombre != "" {
		body["nombre"] = nombre
	}
	if fija != nil {
		body["fija"] = *fija
	}
	st, b, err := c.req("PATCH", "/v1/sessions/"+id, body)
	if err != nil {
		return "", false, err
	}
	var v struct {
		Nombre string `json:"nombre"`
		Fija   bool   `json:"fija"`
	}
	if err := json.Unmarshal(b, &v); err != nil || st != 200 {
		return "", false, fmt.Errorf("%s", F(c.Lang, "err_request",
			map[string]string{"status": fmt.Sprint(st)}))
	}
	return v.Nombre, v.Fija, nil
}

// DeleteSession borra (la UI confirma antes, M2.2).
func (c *Client) DeleteSession(id string) error {
	st, _, err := c.req("DELETE", "/v1/sessions/"+id, nil)
	if err != nil {
		return err
	}
	if st != 200 {
		return fmt.Errorf("%s", F(c.Lang, "err_request",
			map[string]string{"status": fmt.Sprint(st)}))
	}
	return nil
}

// GetUi trae panel abierto + sesión recordada (M2.7).
func (c *Client) GetUi() (bool, string) {
	st, b, err := c.req("GET", "/v1/ui", nil)
	if err != nil || st != 200 {
		return true, ""
	}
	var v struct {
		PanelOpen bool   `json:"panelOpen"`
		SessionID string `json:"sessionId"`
	}
	if err := json.Unmarshal(b, &v); err != nil {
		return true, ""
	}
	return v.PanelOpen, v.SessionID
}

// SetUi persiste panel/sesión (M2.7). Best-effort.
func (c *Client) SetUi(open bool, sessionID string) {
	_, _, _ = c.req("POST", "/v1/ui", map[string]any{"panelOpen": open, "sessionId": sessionID})
}

// Turn es un intercambio guardado.
type Turn struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// History trae los turnos de una sesión para reanudarla.
func (c *Client) History(id string) ([]Turn, string, error) {
	st, b, err := c.req("GET", "/v1/sessions/"+id, nil)
	if err != nil {
		return nil, "", err
	}
	if st != 200 {
		return nil, "", fmt.Errorf("%s", F(c.Lang, "err_session_status",
			map[string]string{"status": fmt.Sprint(st)}))
	}
	var v struct {
		Nombre string `json:"nombre"`
		Turnos []Turn  `json:"turnos"`
	}
	if err := json.Unmarshal(b, &v); err != nil {
		return nil, "", err
	}
	return v.Turnos, v.Nombre, nil
}
// Llama onEvent por cada evento; heartbeat (:) se ignora.
// SetModel fija el modelo preferido en el motor (POST /v1/model).
func (c *Client) SetModel(id string) error {
	st, b, err := c.req("POST", "/v1/model", map[string]any{"id": id})
	if err != nil {
		return err
	}
	if st != 200 {
		return fmt.Errorf("%s", F(c.Lang, "err_model_status",
			map[string]string{"status": fmt.Sprint(st), "body": strings.TrimSpace(string(b))}))
	}
	return nil
}

// ModelStatsEntry holds per-model latency/score data.
type ModelStatsEntry struct {
	AvgLatencyMs *float64 `json:"avgLatencyMs"`
	Score        float64  `json:"score"`
}

// ModelStats returns latency/score stats from the motor (GET /v1/model/stats).
func (c *Client) ModelStats() (map[string]ModelStatsEntry, error) {
	st, b, err := c.req("GET", "/v1/model/stats", nil)
	if err != nil {
		return nil, err
	}
	if st != 200 {
		return nil, fmt.Errorf("model/stats %d", st)
	}
	var resp struct {
		Stats map[string]ModelStatsEntry `json:"stats"`
	}
	if err := json.Unmarshal(b, &resp); err != nil {
		return nil, err
	}
	return resp.Stats, nil
}

// McpServer holds MCP server info (name + tool names).
type McpServer struct {
	Name  string   `json:"name"`
	Tools []string `json:"tools"`
}

// McpServers returns connected MCP servers from the motor (GET /v1/mcp/servers).
func (c *Client) McpServers() ([]McpServer, error) {
	st, b, err := c.req("GET", "/v1/mcp/servers", nil)
	if err != nil {
		return nil, err
	}
	if st != 200 {
		return nil, fmt.Errorf("mcp/servers %d", st)
	}
	var resp struct {
		Servers []McpServer `json:"servers"`
	}
	if err := json.Unmarshal(b, &resp); err != nil {
		return nil, err
	}
	return resp.Servers, nil
}

// McpTool holds MCP tool info.
type McpTool struct {
	Name        string  `json:"name"`
	Server      string  `json:"server"`
	Description *string `json:"description"`
}

// McpTools returns all available MCP tools (GET /v1/mcp/tools).
func (c *Client) McpTools() ([]McpTool, error) {
	st, b, err := c.req("GET", "/v1/mcp/tools", nil)
	if err != nil {
		return nil, err
	}
	if st != 200 {
		return nil, fmt.Errorf("mcp/tools %d", st)
	}
	var resp struct {
		Tools []McpTool `json:"tools"`
	}
	if err := json.Unmarshal(b, &resp); err != nil {
		return nil, err
	}
	return resp.Tools, nil
}

// ParallelToggle toggles the parallel mode (POST /v1/parallel).
func (c *Client) ParallelToggle() (bool, error) {
	st, b, err := c.req("POST", "/v1/parallel", nil)
	if err != nil {
		return false, err
	}
	if st != 200 {
		return false, fmt.Errorf("parallel %d", st)
	}
	var resp struct {
		Parallel bool `json:"parallel"`
	}
	if err := json.Unmarshal(b, &resp); err != nil {
		return false, err
	}
	return resp.Parallel, nil
}

// LangInfo es un idioma de interfaz (código + nombre nativo, del motor).
type LangInfo struct {
	Code   string `json:"code"`
	Native string `json:"native"`
}

// Langs trae idioma UI actual, modo de respuesta y lista (GET /v1/langs).
func (c *Client) Langs() (ui, answer string, langs []LangInfo, err error) {
	st, b, err := c.req("GET", "/v1/langs", nil)
	if err != nil {
		return "", "", nil, err
	}
	if st != 200 {
		return "", "", nil, fmt.Errorf("%s", F(c.Lang, "err_request",
			map[string]string{"status": fmt.Sprint(st)}))
	}
	var v struct {
		UI     string     `json:"ui"`
		Answer string     `json:"answer"`
		Langs  []LangInfo `json:"langs"`
	}
	if err := json.Unmarshal(b, &v); err != nil {
		return "", "", nil, err
	}
	return v.UI, v.Answer, v.Langs, nil
}

// SetLang fija el idioma de interfaz (POST /v1/lang). Devuelve lang + msg.
func (c *Client) SetLang(lang string) (string, string, error) {
	st, b, err := c.req("POST", "/v1/lang", map[string]any{"lang": lang})
	if err != nil {
		return "", "", err
	}
	var v struct {
		Lang string `json:"lang"`
		Msg  string `json:"msg"`
		Auto bool   `json:"auto"`
	}
	if err := json.Unmarshal(b, &v); err != nil || st != 200 {
		return "", "", fmt.Errorf("%s", F(c.Lang, "err_request",
			map[string]string{"status": fmt.Sprint(st)}))
	}
	return v.Lang, v.Msg, nil
}

// SetAnswer fija el idioma de respuesta: auto|ui|código (POST /v1/lang/answer).
func (c *Client) SetAnswer(mode string) (string, error) {
	st, b, err := c.req("POST", "/v1/lang/answer", map[string]any{"mode": mode})
	if err != nil {
		return "", err
	}
	var v struct {
		Mode string `json:"mode"`
		Msg  string `json:"msg"`
	}
	if err := json.Unmarshal(b, &v); err != nil || st != 200 {
		return "", fmt.Errorf("%s", F(c.Lang, "err_request",
			map[string]string{"status": fmt.Sprint(st)}))
	}
	return v.Msg, nil
}

// SetTitle fija el titulador auto|off (POST /v1/title). Devuelve el mensaje.
func (c *Client) SetTitle(mode string) (string, error) {
	st, b, err := c.req("POST", "/v1/title", map[string]any{"mode": mode})
	if err != nil {
		return "", err
	}
	var v struct {
		Mode string `json:"mode"`
		Msg  string `json:"msg"`
	}
	if err := json.Unmarshal(b, &v); err != nil || st != 200 {
		return "", fmt.Errorf("%s", F(c.Lang, "err_request",
			map[string]string{"status": fmt.Sprint(st)}))
	}
	return v.Msg, nil
}

// Learn trae reglas y resumen (GET /v1/learn, H1.4).
func (c *Client) Learn() (string, error) {
	st, b, err := c.req("GET", "/v1/learn", nil)
	if err != nil {
		return "", err
	}
	if st != 200 {
		return "", fmt.Errorf("%s", F(c.Lang, "err_request",
			map[string]string{"status": fmt.Sprint(st)}))
	}
	var v struct {
		Rules *struct {
			UpdatedAt string `json:"updatedAt"`
			Rules     map[string]struct {
				Level  string  `json:"level"`
				N      int     `json:"n"`
				OkRate float64 `json:"okRate"`
			} `json:"defaultLevelByTask"`
		} `json:"rules"`
		Stats map[string]struct {
			N     int `json:"n"`
			OkPct int `json:"okPct"`
			P50ms int `json:"p50ms"`
		} `json:"stats"`
	}
	if err := json.Unmarshal(b, &v); err != nil {
		return "", err
	}
	var sb strings.Builder
	if v.Rules == nil || len(v.Rules.Rules) == 0 {
		sb.WriteString(T(c.Lang, "learn_empty"))
	} else {
		first := true
		for task, r := range v.Rules.Rules {
			if !first {
				sb.WriteString("\n")
			}
			first = false
			sb.WriteString(F(c.Lang, "learn_row", map[string]string{
				"task": task, "level": r.Level, "n": fmt.Sprint(r.N),
				"pct": fmt.Sprint(int(r.OkRate*100+0.5)),
			}))
		}
	}
	sb.WriteString("\n")
	for task, s := range v.Stats {
		sb.WriteString(F(c.Lang, "learn_stat", map[string]string{
			"task": task, "n": fmt.Sprint(s.N), "pct": fmt.Sprint(s.OkPct),
			"ms": fmt.Sprint(s.P50ms),
		}) + "\n")
	}
	return strings.TrimRight(sb.String(), "\n"), nil
}

// RevertLearn revierte una regla (POST /v1/learn/revert, H1.4).
func (c *Client) RevertLearn(task string) (string, error) {
	st, _, err := c.req("POST", "/v1/learn/revert", map[string]any{"task": task})
	if err != nil {
		return "", err
	}
	if st != 200 {
		return "", fmt.Errorf("%s", F(c.Lang, "err_request",
			map[string]string{"status": fmt.Sprint(st)}))
	}
	return F(c.Lang, "learn_reverted", map[string]string{"task": task}), nil
}

// Stream abre el SSE único y emite eventos hasta que se cierre o ctx cancele.
// Llama onEvent por cada evento; heartbeat (:) se ignora.
func (c *Client) Stream(onEvent func(Event), onError func(error)) {
	req, err := http.NewRequest("GET", c.Base+"/v1/events?protocol="+PROTOCOL, nil)
	if err != nil {
		onError(err)
		return
	}
	req.Header.Set("Authorization", "Bearer "+c.Token)
	req.Header.Set("X-Noira-Protocol", PROTOCOL)
	cli := &http.Client{Timeout: 0}
	resp, err := cli.Do(req)
	if err != nil {
		onError(err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode == 409 {
		onError(fmt.Errorf("%s", T(c.Lang, "err_screen_connected")))
		return
	}
	if resp.StatusCode != 200 {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<10))
		onError(fmt.Errorf("%s", F(c.Lang, "err_events_status",
			map[string]string{"status": fmt.Sprint(resp.StatusCode), "body": strings.TrimSpace(string(b))})))
		return
	}
	sc := bufio.NewScanner(resp.Body)
	sc.Buffer(make([]byte, 1024*1024), 1024*1024)
	var name string
	var data strings.Builder
	flush := func() {
		if name == "" {
			data.Reset()
			return
		}
		var m map[string]any
		if err := json.Unmarshal([]byte(data.String()), &m); err != nil {
			m = map[string]any{"_raw": data.String()}
		}
		onEvent(Event{Name: name, Data: m})
		name = ""
		data.Reset()
	}
	for sc.Scan() {
		line := sc.Text()
		if line == "" {
			flush()
			continue
		}
		if strings.HasPrefix(line, ":") {
			continue // heartbeat / comentario
		}
		if strings.HasPrefix(line, "event:") {
			name = strings.TrimSpace(strings.TrimPrefix(line, "event:"))
		} else if strings.HasPrefix(line, "data:") {
			data.WriteString(strings.TrimPrefix(line, "data:"))
		}
	}
	if err := sc.Err(); err != nil {
		onError(fmt.Errorf("%s", F(c.Lang, "err_stream_cut",
			map[string]string{"detail": err.Error()})))
		return
	}
	onError(fmt.Errorf("%s", T(c.Lang, "err_stream_closed")))
}
