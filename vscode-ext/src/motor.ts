import * as http from "http";

export class MotorClient {
  private port: number;
  private token: string;

  constructor(port: number, token: string) {
    this.port = port;
    this.token = token;
  }

  private async request(method: string, path: string, body?: object): Promise<any> {
    return new Promise((resolve) => {
      const data = body ? JSON.stringify(body) : undefined;
      const opts: http.RequestOptions = {
        hostname: "127.0.0.1",
        port: this.port,
        path,
        method,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.token}`,
          "X-Noira-Protocol": "2",
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
        },
      };

      const req = http.request(opts, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve(null);
          }
        });
      });

      req.on("error", () => resolve(null));
      req.setTimeout(5000, () => { req.destroy(); resolve(null); });
      if (data) req.write(data);
      req.end();
    });
  }

  async health(): Promise<boolean> {
    try {
      const r = await this.request("GET", "/health");
      return r?.ok === true;
    } catch {
      return false;
    }
  }

  async newSession(): Promise<string | null> {
    const r = await this.request("POST", "/v1/sessions", { level: "low" });
    return r?.id ?? null;
  }

  async turn(message: string, sessionId: string): Promise<string | null> {
    const r = await this.request("POST", "/v1/turn", {
      message,
      sessionId,
      mode: "build",
    });
    return r?.reply ?? r?.content ?? null;
  }

  async sessions(): Promise<any[]> {
    const r = await this.request("GET", "/v1/sessions");
    return r?.sessions ?? [];
  }

  close() {
    // HTTP client doesn't need explicit close
  }
}
