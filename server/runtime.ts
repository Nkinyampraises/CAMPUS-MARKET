const globalObject = globalThis as any;
const nativeDeno = globalObject.Deno;
const isNativeDenoRuntime = Boolean(
  nativeDeno &&
  typeof nativeDeno === "object" &&
  nativeDeno.version &&
  typeof nativeDeno.version.deno === "string",
);

// Only polyfill Deno in non-Deno runtimes (for Node/Vercel compatibility).
if (!isNativeDenoRuntime) {
  const existingDeno = nativeDeno || {};

  if (!existingDeno.env || typeof existingDeno.env.get !== "function") {
    existingDeno.env = {
      get: (key: string) => {
        if (typeof process !== "undefined" && process?.env) {
          const value = process.env[key];
          return typeof value === "string" ? value : "";
        }
        return "";
      },
    };
  }

  if (!existingDeno.errors || typeof existingDeno.errors !== "object") {
    existingDeno.errors = {};
  }

  if (!existingDeno.errors.AddrInUse) {
    existingDeno.errors.AddrInUse = class AddrInUse extends Error {};
  }

  if (typeof existingDeno.serve !== "function") {
    existingDeno.serve = () => undefined;
  }

  if (typeof existingDeno.exit !== "function") {
    existingDeno.exit = (code = 1) => {
      throw new Error(`Deno.exit(${code})`);
    };
  }

  globalObject.Deno = existingDeno;
}
