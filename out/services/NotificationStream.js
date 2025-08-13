"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationStream = void 0;
const ws_1 = __importDefault(require("ws"));
class NotificationStream {
    ws = null;
    disposed = false;
    reconnectAttempts = 0;
    heartbeatTimer = null;
    idleTimer = null;
    url;
    channel;
    reconnectBaseDelayMs;
    reconnectMaxDelayMs;
    heartbeatIntervalMs;
    idleTimeoutMs;
    constructor(opts) {
        this.url = opts.url;
        this.channel = opts.channel;
        this.reconnectBaseDelayMs = opts.reconnectBaseDelayMs ?? 1000;
        this.reconnectMaxDelayMs = opts.reconnectMaxDelayMs ?? 15000;
        this.heartbeatIntervalMs = opts.heartbeatIntervalMs ?? 15000;
        this.idleTimeoutMs = opts.idleTimeoutMs ?? 20000;
        if (opts.autoStart !== false)
            this.connect();
    }
    connect() {
        if (this.disposed)
            return;
        if (this.ws && (this.ws.readyState === ws_1.default.OPEN || this.ws.readyState === ws_1.default.CONNECTING))
            return;
        this.channel.appendLine(`[RAINA] Connecting to ${this.url} ...`);
        this.ws = new ws_1.default(this.url);
        this.ws.on("open", () => {
            this.reconnectAttempts = 0;
            this.channel.appendLine("[RAINA] Connected.");
            this.startHeartbeat();
        });
        this.ws.on("message", (data) => this.onMessage(data));
        this.ws.on("pong", () => {
            if (this.idleTimer) {
                clearTimeout(this.idleTimer);
                this.idleTimer = null;
            }
        });
        this.ws.on("error", (err) => {
            this.channel.appendLine(`[RAINA] WebSocket error: ${err instanceof Error ? err.message : String(err)}`);
        });
        this.ws.on("close", (code, reason) => {
            this.stopHeartbeat();
            this.channel.appendLine(`[RAINA] Disconnected (${code}${reason ? ` ${reason}` : ""}).`);
            if (!this.disposed)
                this.scheduleReconnect();
        });
    }
    onMessage(raw) {
        try {
            const text = typeof raw === "string" ? raw : raw.toString("utf8");
            let line = text;
            try {
                const obj = JSON.parse(text);
                const evt = obj.event ?? obj.type ?? "event";
                const lvl = (obj.level ?? obj.severity ?? "info").toString().toUpperCase();
                const msg = obj.message ?? obj.text ?? obj.detail ?? "";
                const rest = Object.keys(obj)
                    .filter(k => !["event", "type", "level", "severity", "message", "text", "detail"].includes(k))
                    .reduce((acc, k) => (acc[k] = obj[k], acc), {});
                const tail = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : "";
                line = `[${lvl}] ${evt}: ${msg}${tail}`;
            }
            catch {
                // not JSON; print raw
            }
            this.channel.appendLine(line);
        }
        catch (err) {
            this.channel.appendLine(`[RAINA] Failed to handle message: ${String(err)}`);
        }
    }
    scheduleReconnect() {
        this.reconnectAttempts += 1;
        const exp = Math.min(this.reconnectBaseDelayMs * Math.pow(2, this.reconnectAttempts - 1), this.reconnectMaxDelayMs);
        const jitter = Math.floor(Math.random() * 250);
        const delay = exp + jitter;
        this.channel.appendLine(`[RAINA] Reconnecting in ${Math.round(delay / 1000)}s ...`);
        setTimeout(() => this.connect(), delay);
    }
    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            if (!this.ws || this.ws.readyState !== ws_1.default.OPEN)
                return;
            try {
                this.ws.ping();
                if (this.idleTimer)
                    clearTimeout(this.idleTimer);
                this.idleTimer = setTimeout(() => {
                    this.channel.appendLine("[RAINA] Heartbeat timeout; forcing reconnect.");
                    try {
                        this.ws?.terminate();
                    }
                    catch { }
                }, this.idleTimeoutMs);
            }
            catch (e) {
                this.channel.appendLine(`[RAINA] Heartbeat error: ${String(e)}`);
            }
        }, this.heartbeatIntervalMs);
    }
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
    }
    dispose() {
        this.disposed = true;
        this.stopHeartbeat();
        if (this.ws) {
            try {
                this.ws.close();
            }
            catch { }
            this.ws = null;
        }
    }
}
exports.NotificationStream = NotificationStream;
//# sourceMappingURL=NotificationStream.js.map