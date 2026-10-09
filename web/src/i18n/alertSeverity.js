/** Localized alert severity for toasts and browser notifications. */
export function alertSeverityLabel(severity, t) {
  const map = {
    info: 'alert.severityInfo',
    warning: 'alert.severityWarning',
    critical: 'alert.severityCritical',
  };
  const key = map[severity];
  if (!key) return severity || '';
  const translated = t(key);
  return translated === key ? severity : translated;
}
