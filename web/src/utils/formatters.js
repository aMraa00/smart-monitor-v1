/** Presentation helpers shared by the whole dashboard. */

/** Format a capability value with its registry decimals, guarding NaN. */
export function formatValue(value, { decimals = 1 } = {}) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  const num = Number(value);
  if (Math.abs(num) >= 100000) return num.toExponential(2);
  return num.toFixed(decimals);
}

/** Absolute pressure in hPa is what people expect; Pa is what we store. */
export function toHectopascal(pa) {
  return Number(pa) / 100;
}

/** "2026-02-10T09:15:00.000Z" -> "Feb 10, 09:15" in the viewer's timezone. */
export function formatDateTime(value, locale) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(locale || undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Short axis label for chart ticks. */
export function formatTick(value, bucket) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  if (bucket === 'day') return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (bucket === 'hour') return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit' });
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** "3 minutes ago" / "just now" - tolerant of null (device never seen). */
export function formatRelative(value, t, dateLocale) {
  if (!t) {
    if (!value) return 'never';
    const then = new Date(value).getTime();
    if (Number.isNaN(then)) return 'never';
    const seconds = Math.round((Date.now() - then) / 1000);
    if (seconds < 0) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days}d ago`;
    return formatDateTime(value, dateLocale);
  }

  if (!value) return t('time.never');
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return t('time.never');

  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 0) return t('time.justNow');
  if (seconds < 60) return t('time.secondsAgo', { n: seconds });
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return t('time.minutesAgo', { n: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t('time.hoursAgo', { n: hours });
  const days = Math.round(hours / 24);
  if (days < 30) return t('time.daysAgo', { n: days });
  return formatDateTime(value, dateLocale);
}

/** Map API device.status to a translated label. */
export function deviceStatusLabel(status, t) {
  if (!status || !t) return status || '—';
  const cap = status.charAt(0).toUpperCase() + status.slice(1);
  const key = `deviceDetail.deviceStatus${cap}`;
  const translated = t(key);
  return translated === key ? status : translated;
}

/** Upper bound for “online” (fleet list default). */
export const ONLINE_WINDOW_MS = 5 * 60 * 1000;

/** Per-device window: ~2.5× sample interval (min 90s, max 5 min). */
export function onlineWindowMs(sampleIntervalS = 60) {
  const sec = Math.max(5, Number(sampleIntervalS) || 60);
  return Math.min(ONLINE_WINDOW_MS, Math.max(90_000, sec * 2.5 * 1000));
}

export function isOnline(lastSeenAt, sampleIntervalS) {
  if (!lastSeenAt) return false;
  const then = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(then)) return false;
  const windowMs = sampleIntervalS !== undefined ? onlineWindowMs(sampleIntervalS) : ONLINE_WINDOW_MS;
  return Date.now() - then <= windowMs;
}

export function isDeviceOnline(device) {
  if (!device) return false;
  if (['revoked', 'unclaimed', 'offline'].includes(device.status)) return false;
  return isOnline(device.lastSeenAt, device.config?.sampleIntervalS ?? 60);
}

export const STATUS_TONE = {
  active: 'ok',
  offline: 'warn',
  unclaimed: 'neutral',
  revoked: 'danger',
};
