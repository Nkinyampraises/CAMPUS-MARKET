/**
 * <T> — Universal translation component.
 * Uses the pre-translated FR_TRANSLATIONS first (instant),
 * falls back to MyMemory API for anything not pre-translated.
 *
 * Usage: <T>My Dashboard</T>  →  "Mon tableau de bord" in FR
 */
import { useLanguage } from '@/contexts/LanguageContext';
import { useAutoTranslateSingle } from '@/hooks/useAutoTranslate';

interface TProps {
  children: string;
}

// Generate the same key the pre-translation script uses
function makeKey(text: string): string {
  const key = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 50);
  return `ui.${key}`;
}

// Inner component that only runs auto-translate when needed
function AutoT({ children }: TProps) {
  const { translated } = useAutoTranslateSingle(children || '');
  return <>{translated || children}</>;
}

export function T({ children }: TProps) {
  const { language, t } = useLanguage();

  if (!children) return null;

  // English — return as-is
  if (language !== 'fr') return <>{children}</>;

  // French — try pre-translated key first (instant, no API)
  const key = makeKey(children);
  const preTranslated = t(key, children);

  // If pre-translation found (different from English), use it instantly
  if (preTranslated !== children) {
    return <>{preTranslated}</>;
  }

  // Fallback: use MyMemory API async translation
  return <AutoT>{children}</AutoT>;
}
