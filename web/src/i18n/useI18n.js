import { useCallback } from 'react';
import { usePreferencesStore } from '../stores/preferencesStore';
import { translations, formatMessage } from './translations';

export function useI18n() {
  const locale = usePreferencesStore((s) => s.locale);
  const setLocale = usePreferencesStore((s) => s.setLocale);

  const dict = translations[locale] || translations.mn;

  const t = useCallback(
    (path, vars) => {
      const parts = path.split('.');
      let node = dict;
      for (const part of parts) {
        node = node?.[part];
        if (node === undefined) return path;
      }
      return typeof node === 'string' ? formatMessage(node, vars) : path;
    },
    [dict]
  );

  const dateLocale = locale === 'mn' ? 'mn-MN' : 'en-US';

  return { t, locale, setLocale, dateLocale };
}
