/**
 * <T> — Universal auto-translation component.
 * Wrap any hardcoded English string and it will automatically
 * translate to French when the user switches to FR.
 *
 * Usage:
 *   <T>My Dashboard</T>          → "Mon tableau de bord"
 *   <T>No orders found.</T>      → "Aucune commande trouvée."
 *
 * Translations are cached in localStorage so each string is
 * only ever sent to the API once per device.
 */
import { useAutoTranslateSingle } from '@/hooks/useAutoTranslate';

interface TProps {
  children: string;
}

export function T({ children }: TProps) {
  const { translated } = useAutoTranslateSingle(children || '');
  return <>{translated || children}</>;
}
