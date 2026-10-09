/**
 * Map API `{ code, message, status, details }` to localized UI copy.
 * Unknown codes fall back to the server message, then a generic string.
 */
export function translateApiError(err, t) {
  if (!err) return t('errors.generic');

  if (typeof err === 'string') {
    return err;
  }

  const code = err.code;
  if (code) {
    const key = `errors.${code}`;
    const translated = t(key);
    if (translated !== key) {
      if (code === 'RATE_LIMITED') {
        const match = String(err.message || '').match(/(\d+)\s*s/i);
        if (match) return t('errors.RATE_LIMITED_SEC', { sec: match[1] });
      }
      return translated;
    }
  }

  if (code === 'NETWORK_ERROR' || err.status === 0) return t('errors.NETWORK_ERROR');
  if (err.status === 422) return t('errors.VALIDATION_ERROR');

  return err.message || t('errors.generic');
}
