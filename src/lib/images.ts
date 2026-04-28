const SUPABASE_SIGNED_SEGMENT = "/storage/v1/object/sign/";
const SUPABASE_PUBLIC_SEGMENT = "/storage/v1/object/public/";
const LEGACY_UNAVAILABLE_IMAGE_HOSTS = new Set([
  "gidhrctnjfxzccaplkjj.supabase.co",
]);

const trimImageUrl = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export const normalizeImageUrl = (value: unknown) => trimImageUrl(value);

const isLegacyUnavailableImageHost = (value: unknown) => {
  const source = trimImageUrl(value);
  if (!source) {
    return false;
  }

  try {
    const host = new URL(source).hostname.toLowerCase();
    return LEGACY_UNAVAILABLE_IMAGE_HOSTS.has(host);
  } catch {
    return false;
  }
};

export const toSupabasePublicUrl = (value: unknown) => {
  const source = trimImageUrl(value);
  if (!source || !source.includes(SUPABASE_SIGNED_SEGMENT)) {
    return "";
  }

  const withoutToken = source.replace(/\?.*$/, "");
  return withoutToken.replace(SUPABASE_SIGNED_SEGMENT, SUPABASE_PUBLIC_SEGMENT);
};

export const buildImageCandidates = (value: unknown) => {
  const primary = normalizeImageUrl(value);
  if (!primary || isLegacyUnavailableImageHost(primary)) {
    return [];
  }

  const legacySupabasePublic = toSupabasePublicUrl(primary);

  const unique = new Set<string>();
  unique.add(primary);
  if (legacySupabasePublic) {
    unique.add(legacySupabasePublic);
  }

  return Array.from(unique);
};
