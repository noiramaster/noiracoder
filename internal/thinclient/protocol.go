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

// Cancel cancela el turno en curso.
func (c *Client) Cancel(turnID string) error {
	_, _, err := c.req("POST", "/v1/cancel", map[string]any{"turnId": turnID})
	return err
}

// Session resume de /v1/sessions.
type Session struct {
	ID     string `json:"id"`
	Nombre string `json:"nombre"`
	Turnos int    `json:"turnos"`
	Rel    string `json:"rel"`
}

// Turn es un intercambio guardado.
type Turn struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// Sessions lista sesiones persistidas (sobreviven a reinicios).
func (c *Client) Sessions() ([]Session, error) {
	st, b, err := c.req("GET", "/v1/sessions", nil)
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
