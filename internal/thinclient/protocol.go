// Package thinclient — pantalla Go como CLIENTE FINO del motor TS.
// Solo pinta y recoge teclas. No importa (ni enlaza) herramientas,
// permisos, proveedores ni sesiones heredados de opencode.
package thinclient

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// PROTOCOL es la versión de docs/PROTOCOL.md que habla este cliente.
const PROTOCOL = "1"

// Event es un evento SSE del motor.
type Event struct {
	Name string
	Data map[string]any
}

// Client habla con el motor thin en 127.0.0.1.
type Client struct {
	Base  string
	Token string
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
		return "", fmt.Errorf("health ilegible: %w", err)
	}
	if !v.OK {
		return "", fmt.Errorf("motor no ok")
	}
	if fmt.Sprint(v.Protocol) != PROTOCOL {
		return "", fmt.Errorf("protocolo distinto: motor v%d, cliente v%s (actualiza noira / noira-go)", v.Protocol, PROTOCOL)
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
		return "", "", fmt.Errorf("ya hay un turno en curso")
	}
	if st != 202 {
		return "", "", fmt.Errorf("turno rechazado (%d): %s", st, strings.TrimSpace(string(b)))
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
		return fmt.Errorf("confirm rechazado (%d): %s", st, strings.TrimSpace(string(b)))
	}
	return nil
}

// Cancel cancela el turno en curso.
func (c *Client) Cancel(turnID string) error {
	_, _, err := c.req("POST", "/v1/cancel", map[string]any{"turnId": turnID})
	return err
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
		onError(fmt.Errorf("ya hay una pantalla conectada (409)"))
		return
	}
	if resp.StatusCode != 200 {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<10))
		onError(fmt.Errorf("events %d: %s", resp.StatusCode, strings.TrimSpace(string(b))))
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
		onError(fmt.Errorf("stream cortado: %w", err))
		return
	}
	onError(fmt.Errorf("stream cerrado por el motor"))
}
