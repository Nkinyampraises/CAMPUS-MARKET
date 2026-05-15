/**
 * Auto-translation using MyMemory API (free, no API key required).
 * Translates product titles and descriptions on the fly.
 * Results are cached in localStorage so the same text is never translated twice.
 */

const CACHE_KEY = 'unitrade-translation-cache-v1';
const CACHE_MAX = 2000; // max entries before trimming

type TranslationCache = Record<string, string>;

const loadCache = (): TranslationCache => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveCache = (cache: TranslationCache) => {
  try {
    const keys = Object.keys(cache);
    // Trim oldest entries if cache gets too large
    const trimmed: TranslationCache = {};
    keys.slice(-CACHE_MAX).forEach((k) => { trimmed[k] = cache[k]; });
    localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore storage errors
  }
};

const cacheKey = (text: string, from: string, to: string) =>
  `${from}:${to}:${text.trim().slice(0, 120)}`;

/**
 * Translate a single piece of text using MyMemory API.
 * Returns the original text if translation fails.
 */
export async function translateText(
  text: string,
  from: 'en' | 'fr' = 'en',
  to: 'en' | 'fr' = 'fr',
): Promise<string> {
  if (!text?.trim() || from === to) return text;

  const key = cacheKey(text, from, to);
  const cache = loadCache();

  // Return cached translation if available
  if (cache[key]) return cache[key];

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.trim())}&langpair=${from}|${to}&de=praisessasha8@gmail.com`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const data = await res.json();

    const translated = data?.responseData?.translatedText;
    if (translated && typeof translated === 'string' && translated !== text) {
      cache[key] = translated;
      saveCache(cache);
      return translated;
    }
  } catch {
    // Network error or timeout — return original
  }

  return text;
}

/**
 * Translate multiple texts in parallel (batched for performance).
 * Returns array of translated strings in the same order.
 * Falls back to originals for any that fail.
 */
export async function translateBatch(
  texts: string[],
  from: 'en' | 'fr' = 'en',
  to: 'en' | 'fr' = 'fr',
): Promise<string[]> {
  if (from === to) return texts;

  const cache = loadCache();
  const results = [...texts];
  const needed: Array<{ index: number; text: string }> = [];

  // Check cache first
  texts.forEach((text, i) => {
    const key = cacheKey(text, from, to);
    if (cache[key]) {
      results[i] = cache[key];
    } else if (text?.trim()) {
      needed.push({ index: i, text });
    }
  });

  if (needed.length === 0) return results;

  // Translate in parallel (max 5 at a time to be polite to the free API)
  const CHUNK = 5;
  for (let i = 0; i < needed.length; i += CHUNK) {
    const chunk = needed.slice(i, i + CHUNK);
    await Promise.all(
      chunk.map(async ({ index, text }) => {
        const translated = await translateText(text, from, to);
        results[index] = translated;
      }),
    );
    // Small delay between chunks so we don't hammer the free API
    if (i + CHUNK < needed.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return results;
}
