'use strict';

const reportsService = require('../services/reports.service');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { isAdmin } = require('../utils/roles');
const { ok } = require('../utils/response');

const getSummary = asyncHandler(async (req, res) => {
  const summary = await reportsService.getFleetSummary();
  return ok(res, summary);
});

const getDevices = asyncHandler(async (req, res) => {
  const items = await reportsService.listDevicesForReport();
  return ok(res, items);
});

const downloadDevicesCsv = asyncHandler(async (req, res) => {
  const csv = await reportsService.exportDevicesCsv();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="smart-monitor-devices.csv"');
  return res.send(csv);
});

const downloadUsersCsv = asyncHandler(async (req, res) => {
  if (!isAdmin(req.user)) {
    throw ApiError.forbidden('ADMIN_ONLY', 'Only administrators may export user accounts');
  }
  const csv = await reportsService.exportUsersCsv();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="smart-monitor-users.csv"');
  return res.send(csv);
});

const downloadTelemetryCsv = asyncHandler(async (req, res) => {
  const csv = await reportsService.exportTelemetryCsv(req.user, req.query);
  const slug = req.query.deviceId ? String(req.query.deviceId).replace(/[^\w-]+/g, '') : 'all';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="smart-monitor-telemetry-${slug}.csv"`);
  return res.send(csv);
});

const downloadTelemetryWorkbook = asyncHandler(async (req, res) => {
  const buffer = await reportsService.exportTelemetryWorkbook(req.user, req.query);
  const slug = req.query.deviceId ? String(req.query.deviceId).replace(/[^\w-]+/g, '') : 'all';
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="Smart_Monitor_Telemetry_Dashboard-${slug}.xlsx"`
  );
  return res.send(Buffer.from(buffer));
});

module.exports = {
  getSummary,
  getDevices,
  downloadDevicesCsv,
  downloadTelemetryCsv,
  downloadTelemetryWorkbook,
  downloadUsersCsv,
};
