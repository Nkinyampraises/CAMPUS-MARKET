import "./server/runtime.js";
import app from "./server/index.js";
import { Buffer } from "node:buffer";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import { WebSocketServer, type WebSocket } from "ws";

const API_WS_PATH = "/make-server-50b25a4f/messages/ws";
const LEGACY_WS_PATH = "/messages/ws";
const CONNECTED_WS_CLIENTS = new Set<WebSocket>();

const parsePort = (value: string | undefined, fallback: number) => {
  const numeric = Number.parseInt(String(value || "").trim(), 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
};

const port = parsePort(process.env.PORT, 3000);

const buildOrigin = (req: IncomingMessage) => {
  const protocol = String(req.headers["x-forwarded-proto"] || "http");
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost");
  return `${protocol}://${host}`;
};

const copyHeaders = (req: IncomingMessage) => {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "undefined") {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
    } else {
      headers.set(key, value);
    }
  }
  return headers;
};

const readBody = async (req: IncomingMessage, method: string) => {
  if (method === "GET" || method === "HEAD") {
    return undefined;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return chunks.length ? Buffer.concat(chunks) : undefined;
};

const toFetchRequest = async (req: IncomingMessage) => {
  const method = String(req.method || "GET").toUpperCase();
  const url = new URL(req.url || "/", buildOrigin(req)).toString();
  const headers = copyHeaders(req);
  const body = await readBody(req, method);

  return new Request(url, {
    method,
    headers,
    ...(body ? { body } : {}),
  });
};

const sendFetchResponse = async (res: ServerResponse, response: Response) => {
  res.statusCode = response.status;

  const setCookieHeader = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() || [];
  if (setCookieHeader.length > 0) {
    res.setHeader("set-cookie", setCookieHeader);
  }

  for (const [key, value] of response.headers.entries()) {
    if (key.toLowerCase() === "set-cookie") {
      continue;
    }
    res.setHeader(key, value);
  }

  const payload = Buffer.from(await response.arrayBuffer());
  res.end(payload);
};

const safeJsonParse = (value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const broadcastWs = (payload: Record<string, unknown>, except?: WebSocket) => {
  const encoded = JSON.stringify(payload);
  for (const client of CONNECTED_WS_CLIENTS) {
    if (client === except) {
      continue;
    }
    if (client.readyState === client.OPEN) {
      client.send(encoded);
    }
  }
};

const server = createServer(async (req, res) => {
  try {
    const request = await toFetchRequest(req);
    const response = await app.fetch(request);
    await sendFetchResponse(res, response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: message }));
  }
});

const wsServer = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const requestUrl = new URL(req.url || "/", buildOrigin(req));
  const pathname = requestUrl.pathname.replace(/\/+$/, "");
  const isWsPath = pathname === API_WS_PATH || pathname === LEGACY_WS_PATH;

  if (!isWsPath) {
    socket.destroy();
    return;
  }

  wsServer.handleUpgrade(req, socket, head, (ws) => {
    wsServer.emit("connection", ws, req);
  });
});

wsServer.on("connection", (ws, req) => {
  const requestUrl = new URL(req.url || "/", buildOrigin(req));
  const token = requestUrl.searchParams.get("token");
  CONNECTED_WS_CLIENTS.add(ws);

  ws.send(JSON.stringify({
    type: "connected",
    timestamp: Date.now(),
    authenticated: Boolean(token),
  }));

  ws.on("message", (raw) => {
    const decoded = String(raw || "");
    const message = safeJsonParse(decoded);
    if (!message || typeof message !== "object") {
      ws.send(JSON.stringify({ type: "error", message: "Invalid WebSocket payload" }));
      return;
    }

    const normalizedType = typeof (message as any).type === "string" ? (message as any).type : "";
    if (normalizedType === "ping") {
      ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
      return;
    }

    if (normalizedType) {
      broadcastWs({ ...(message as Record<string, unknown>) }, ws);
    }
  });

  ws.on("close", () => {
    CONNECTED_WS_CLIENTS.delete(ws);
  });

  ws.on("error", () => {
    CONNECTED_WS_CLIENTS.delete(ws);
  });
});

server.listen(port, () => {
  console.log(`Render backend listening on port ${port}`);
  console.log(`HTTP health: http://localhost:${port}/make-server-50b25a4f/health`);
  console.log(`WebSocket endpoint: ws://localhost:${port}${API_WS_PATH}`);
});

const shutdown = () => {
  for (const client of CONNECTED_WS_CLIENTS) {
    try {
      client.close();
    } catch {
      // no-op
    }
  }

  server.close(() => {
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
