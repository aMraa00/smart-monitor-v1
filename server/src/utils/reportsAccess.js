'use strict';

/** Add calendar months (handles month-end sensibly via Date). */
function addMonths(from, months) {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
}

function isReportsAccessActive(user) {
  if (!user || !user.reportsAccessUntil) return false;
  return new Date(user.reportsAccessUntil).getTime() > Date.now();
}

/** Extend from max(now, current until) by N months. */
function extendReportsUntil(user, months = 1) {
  const now = new Date();
  const base =
    user.reportsAccessUntil && new Date(user.reportsAccessUntil).getTime() > now.getTime()
      ? new Date(user.reportsAccessUntil)
      : now;
  user.reportsAccessUntil = addMonths(base, months);
  user.canAccessReports = true;
}

function revokeReportsAccess(user) {
  user.reportsAccessUntil = null;
  user.canAccessReports = false;
}

module.exports = { addMonths, isReportsAccessActive, extendReportsUntil, revokeReportsAccess };
