import { API_URL } from '@/lib/api';

export type NamedCatalogOption = {
  id: string;
  name: string;
};

const normalizeText = (value: unknown) => String(value ?? '').trim();

const toLookupKey = (value: unknown) => normalizeText(value).toLowerCase();

export const normalizeNamedCatalogOptions = (entries: unknown): NamedCatalogOption[] => {
  if (!Array.isArray(entries)) return [];

  const deduped = new Map<string, NamedCatalogOption>();

  for (const entry of entries) {
    const id = normalizeText((entry as any)?.id);
    const name = normalizeText((entry as any)?.name);
    if (!id || !name) continue;
    const key = `${id.toLowerCase()}::${name.toLowerCase()}`;
    if (!deduped.has(key)) {
      deduped.set(key, { id, name });
    }
  }

  return Array.from(deduped.values());
};

export const resolveNamedCatalogLabel = (
  options: NamedCatalogOption[],
  value: unknown,
  fallback: string,
) => {
  const raw = normalizeText(value);
  if (!raw) return fallback;

  const key = toLookupKey(raw);
  const byId = options.find((option) => toLookupKey(option.id) === key);
  if (byId) return byId.name;

  const byName = options.find((option) => toLookupKey(option.name) === key);
  if (byName) return byName.name;

  return raw;
};

export const fetchPublicCatalog = async (
  resource: 'categories' | 'universities',
): Promise<NamedCatalogOption[]> => {
  const response = await fetch(`${API_URL}/${resource}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return [];
  return normalizeNamedCatalogOptions(data?.[resource]);
};
