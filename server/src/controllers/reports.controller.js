'use strict';

const reportsService = require('../services/reports.service');
const asyncHandler = require('../utils/asyncHandler');
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
  const csv = await reportsService.exportUsersCsv();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="smart-monitor-users.csv"');
  return res.send(csv);
});

module.exports = { getSummary, getDevices, downloadDevicesCsv, downloadUsersCsv };
