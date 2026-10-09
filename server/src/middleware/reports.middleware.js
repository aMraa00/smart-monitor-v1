'use strict';

const ApiError = require('../utils/apiError');
const { canAccessReports } = require('../utils/roles');

/** Report routes: admin always; others need `canAccessReports` on the account. */
function requireReportsAccess(req, _res, next) {
  if (!req.user) return next(ApiError.unauthorized());
  if (canAccessReports(req.user)) return next();
  return next(ApiError.forbidden('REPORTS_FORBIDDEN', 'Report access is not enabled for this account'));
}

module.exports = { requireReportsAccess };
