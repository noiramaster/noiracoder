"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MotorClient = void 0;
const http = __importStar(require("http"));
class MotorClient {
    constructor(port, token) {
        this.port = port;
        this.token = token;
    }
    async request(method, path, body) {
        return new Promise((resolve) => {
            const data = body ? JSON.stringify(body) : undefined;
            const opts = {
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
                    }
                    catch {
                        resolve(null);
                    }
                });
            });
            req.on("error", () => resolve(null));
            req.setTimeout(5000, () => { req.destroy(); resolve(null); });
            if (data)
                req.write(data);
            req.end();
        });
    }
    async health() {
        try {
            const r = await this.request("GET", "/health");
            return r?.ok === true;
        }
        catch {
            return false;
        }
    }
    async newSession() {
        const r = await this.request("POST", "/v1/sessions", { level: "low" });
        return r?.id ?? null;
    }
    async turn(message, sessionId) {
        const r = await this.request("POST", "/v1/turn", {
            message,
            sessionId,
            mode: "build",
        });
        return r?.reply ?? r?.content ?? null;
    }
    async sessions() {
        const r = await this.request("GET", "/v1/sessions");
        return r?.sessions ?? [];
    }
    close() {
        // HTTP client doesn't need explicit close
    }
}
exports.MotorClient = MotorClient;
//# sourceMappingURL=motor.js.map