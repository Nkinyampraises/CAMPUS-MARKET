import app from "../../server/index.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

const API_PREFIX = "/make-server-50b25a4f";

const toPathFromQuery = (req: any) => {
  const raw = req.query.path;
  if (Array.isArray(raw)) {
    return raw.map((part) => String(part || "").trim()).filter(Boolean).join("/");
  }
  if (typeof raw === "string") {
    return raw.trim().replace(/^\/+/, "");
  }
  return "";
};

const toOrigin = (req: any) => {
  const protocol = String(req.headers["x-forwarded-proto"] || "https");
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost");
  return `${protocol}://${host}`;
};

const readRequestBody = async (req: any) => {
  const method = String(req.method || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") {
    return undefined;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    const fallbackBody = req.body;
    if (Buffer.isBuffer(fallbackBody)) {
      return fallbackBody;
    }
    if (typeof fallbackBody === "string") {
      return Buffer.from(fallbackBody);
    }
    if (fallbackBody instanceof Uint8Array) {
      return Buffer.from(fallbackBody);
    }
    if (fallbackBody && typeof fallbackBody === "object") {
      return Buffer.from(JSON.stringify(fallbackBody));
    }
    return undefined;
  }

  return Buffer.concat(chunks);
};

const buildTargetUrl = (req: any) => {
  const requestUrl = new URL(req.url || "/", toOrigin(req));
  const suffix = toPathFromQuery(req);
  requestUrl.pathname = suffix ? `${API_PREFIX}/${suffix}` : API_PREFIX;
  requestUrl.searchParams.delete("path");
  return requestUrl.toString();
};

const copyRequestHeaders = (req: any) => {
  const headers = new Headers();
  const entries = Object.entries(req.headers as Record<string, string | string[] | undefined>);
  for (const [key, value] of entries) {
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

export default async function handler(req: any, res: any) {
  try {
    const body = await readRequestBody(req);
    const request = new Request(buildTargetUrl(req), {
      method: req.method || "GET",
      headers: copyRequestHeaders(req),
      body,
    });

    const response = await app.fetch(request);
    res.status(response.status);

    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "unknown");
    res.status(500).json({ error: "Server error", details: message });
  }
}
