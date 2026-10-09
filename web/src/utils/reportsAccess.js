/** Client-side mirror of server report entitlement checks. */
export function hasReportsAccess(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.reportsAccessUntil) {
    return new Date(user.reportsAccessUntil).getTime() > Date.now();
  }
  // Legacy accounts: flag set before `reportsAccessUntil` existed (server backfills on /auth/me).
  return Boolean(user.canAccessReports);
}

export function formatReportsUntil(until, t, dateLocale) {
  if (!until) return t('users.reportsNone');
  const date = new Date(until);
  if (Number.isNaN(date.getTime())) return t('users.reportsNone');
  const active = date.getTime() > Date.now();
  const formatted = date.toLocaleDateString(dateLocale || undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  if (!active) return t('users.reportsExpired');
  return t('users.reportsUntil', { date: formatted });
}
