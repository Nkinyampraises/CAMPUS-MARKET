const API_ROUTE_SEGMENT = "make-server-50b25a4f";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, "");

const normalizeConfiguredApiBase = (value: string) => {
  const normalized = trimTrailingSlashes(value.trim());
  if (!normalized) {
    return "";
  }

  try {
    const url = new URL(normalized);

    if (typeof window !== "undefined") {
      const currentHost = window.location.hostname;
      const isCurrentHostRemote = Boolean(currentHost) && !LOCAL_HOSTS.has(currentHost);

      if (LOCAL_HOSTS.has(url.hostname) && isCurrentHostRemote) {
        // Ignore localhost config when app is opened from another device.
        // The app will then use same-origin API path (works with Vite proxy/reverse proxy).
        return "";
      }
    }

    return trimTrailingSlashes(url.toString());
  } catch {
    return normalized;
  }
};

const resolveConfiguredBase = () =>
  normalizeConfiguredApiBase(String(import.meta.env.VITE_API_URL || ""));

const resolveNativeBase = () => {
  if (typeof window === "undefined") {
    return "";
  }

  const protocol = window.location.protocol;
  const isNative = protocol === "capacitor:" || protocol === "file:";
  if (!isNative) {
    return "";
  }

  return normalizeConfiguredApiBase(String(import.meta.env.VITE_ANDROID_API_URL || ""));
};

const resolveSameOriginBase = () => {
  if (typeof window === "undefined") {
    return "";
  }

  const origin = window.location.origin;
  if (!origin || origin.startsWith("file:") || origin.startsWith("capacitor:")) {
    return "";
  }

  return trimTrailingSlashes(origin);
};

const joinApiPath = (base: string) => {
  const segmentPath = `/${API_ROUTE_SEGMENT}`;
  if (!base) {
    return segmentPath;
  }
  if (base.endsWith(segmentPath)) {
    return base;
  }
  return `${base}${segmentPath}`;
};

export const API_BASE = resolveNativeBase() || resolveConfiguredBase() || resolveSameOriginBase();
export const API_URL = joinApiPath(API_BASE);
