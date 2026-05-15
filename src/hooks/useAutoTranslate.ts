/**
 * Hook: useAutoTranslate
 * Automatically translates an array of strings when the app language is French.
 * Shows originals immediately, replaces with translations as they load.
 */
import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { translateBatch } from '@/lib/translate';

export function useAutoTranslate(texts: string[]): {
  translated: string[];
  isTranslating: boolean;
} {
  const { language } = useLanguage();
  const [translated, setTranslated] = useState<string[]>(texts);
  const [isTranslating, setIsTranslating] = useState(false);
  const abortRef = useRef(false);

  // Stable key: re-run only when language or texts change
  const textsKey = texts.join('||').slice(0, 500);

  useEffect(() => {
    // Always show originals immediately
    setTranslated(texts);

    if (language === 'en') return;

    // Translate to French
    abortRef.current = false;
    setIsTranslating(true);

    translateBatch(texts, 'en', 'fr').then((results) => {
      if (!abortRef.current) {
        setTranslated(results);
        setIsTranslating(false);
      }
    });

    return () => {
      abortRef.current = true;
      setIsTranslating(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, textsKey]);

  return { translated, isTranslating };
}

/**
 * Hook: useAutoTranslateSingle
 * Translates a single string when language is French.
 */
export function useAutoTranslateSingle(text: string): {
  translated: string;
  isTranslating: boolean;
} {
  const { translated, isTranslating } = useAutoTranslate([text]);
  return { translated: translated[0] ?? text, isTranslating };
}
