'use strict';

const { Device, User, TelemetryLatest, Telemetry } = require('../models');
const ApiError = require('../utils/apiError');
const { isPrivileged } = require('../utils/roles');
const { buildTelemetryWorkbook } = require('./telemetryWorkbook.service');

const DEFAULT_RANGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_EXPORT_SAMPLES = 50000;

function csvEscape(value) {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(columns, rows) {
  const header = columns.map((c) => csvEscape(c.header)).join(',');
  const lines = rows.map((row) => columns.map((c) => csvEscape(c.value(row))).join(','));
  return `\uFEFF${[header, ...lines].join('\n')}`;
}

/** Fleet summary counters for the reports dashboard. */
async function getFleetSummary() {
  const [devicesTotal, usersTotal, latestSamples] = await Promise.all([
    Device.countDocuments({}),
    User.countDocuments({}),
    TelemetryLatest.countDocuments({}),
  ]);

  const statusAgg = await Device.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  const statusCounts = Object.fromEntries(statusAgg.map((row) => [row._id, row.count]));

  const roleAgg = await User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]);
  const roleCounts = Object.fromEntries(roleAgg.map((row) => [row._id, row.count]));

  const reportsGranted = await User.countDocuments({ reportsAccessUntil: { $gt: new Date() } });

  return {
    generatedAt: new Date().toISOString(),
    devices: { total: devicesTotal, byStatus: statusCounts, withLatestTelemetry: latestSamples },
    users: { total: usersTotal, byRole: roleCounts, withReportAccess: reportsGranted },
  };
}

/** Device rows with owner contact (for CSV / JSON export). */
async function listDevicesForReport() {
  const devices = await Device.find({}).sort({ createdAt: -1 }).lean();
  const ownerIds = [...new Set(devices.map((d) => d.owner).filter(Boolean).map(String))];
  const owners = await User.find({ _id: { $in: ownerIds } }).select('email name role').lean();
  const ownerMap = new Map(owners.map((u) => [u._id.toString(), u]));

  return devices.map((d) => {
    const owner = d.owner ? ownerMap.get(d.owner.toString()) : null;
    return {
      deviceId: d.deviceId,
      displayName: d.displayName || '',
      locationName: d.locationName || '',
      model: d.model,
      firmwareVersion: d.firmwareVersion,
      status: d.status,
      lastSeenAt: d.lastSeenAt ? new Date(d.lastSeenAt).toISOString() : '',
      ownerEmail: owner ? owner.email : '',
      ownerName: owner ? owner.name : '',
      ownerRole: owner ? owner.role : '',
      capabilities: (d.capabilities || []).join('|'),
    };
  });
}

async function exportDevicesCsv() {
  const rows = await listDevicesForReport();
  const columns = [
    { header: 'deviceId', value: (r) => r.deviceId },
    { header: 'displayName', value: (r) => r.displayName },
    { header: 'locationName', value: (r) => r.locationName },
    { header: 'status', value: (r) => r.status },
    { header: 'lastSeenAt', value: (r) => r.lastSeenAt },
    { header: 'ownerEmail', value: (r) => r.ownerEmail },
    { header: 'ownerName', value: (r) => r.ownerName },
    { header: 'ownerRole', value: (r) => r.ownerRole },
    { header: 'model', value: (r) => r.model },
    { header: 'firmwareVersion', value: (r) => r.firmwareVersion },
    { header: 'capabilities', value: (r) => r.capabilities },
  ];
  return toCsv(columns, rows);
}

function parseExportRange(fromRaw, toRaw) {
  const to = toRaw ? new Date(toRaw) : new Date();
  const from = fromRaw ? new Date(fromRaw) : new Date(to.getTime() - DEFAULT_RANGE_MS);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw ApiError.badRequest('INVALID_RANGE', 'Invalid from/to date');
  }
  if (from.getTime() > to.getTime()) {
    throw ApiError.badRequest('INVALID_RANGE', 'from must be before to');
  }
  return { from, to };
}

/** Devices the caller may include in a telemetry export. */
async function resolveTelemetryDeviceScope(user, deviceId) {
  if (deviceId) {
    const device = await Device.findOne({ deviceId }).lean();
    if (!device) throw ApiError.notFound('DEVICE_NOT_FOUND', 'Device not found');
    if (!isPrivileged(user) && String(device.owner) !== String(user._id)) {
      throw ApiError.forbidden('DEVICE_FORBIDDEN', 'You do not own this device');
    }
    return { devices: [device], deviceMap: new Map([[String(device._id), device]]) };
  }

  const filter = isPrivileged(user) ? {} : { owner: user._id };
  const devices = await Device.find(filter).select('deviceId displayName locationName _id').lean();
  const deviceMap = new Map(devices.map((d) => [String(d._id), d]));
  return { devices, deviceMap };
}

async function loadTelemetrySamples(user, { deviceId, from: fromRaw, to: toRaw, limit = 10000 }) {
  const { from, to } = parseExportRange(fromRaw, toRaw);
  const maxSamples = Math.min(Math.max(Number(limit) || 10000, 1), MAX_EXPORT_SAMPLES);
  const { devices, deviceMap } = await resolveTelemetryDeviceScope(user, deviceId);
  if (devices.length === 0) return { docs: [], deviceMap, from, to };

  const deviceIds = devices.map((d) => d._id);
  const docs = await Telemetry.find({
    device: { $in: deviceIds },
    ts: { $gte: from, $lte: to },
  })
    .sort({ ts: 1 })
    .limit(maxSamples)
    .lean();

  return { docs, deviceMap, from, to };
}

function longRowsFromDocs(docs, deviceMap) {
  const rows = [];
  for (const doc of docs) {
    const meta = deviceMap.get(String(doc.device));
    const caps = doc.capabilities || {};
    const entries = caps instanceof Map ? [...caps.entries()] : Object.entries(caps);
    for (const [capability, reading] of entries) {
      if (!reading || typeof reading.value !== 'number') continue;
      rows.push({
        deviceId: meta?.deviceId || doc.deviceId,
        displayName: meta?.displayName || '',
        locationName: meta?.locationName || '',
        ts: doc.ts ? new Date(doc.ts).toISOString() : '',
        sampleId: doc.sampleId || '',
        timeQuality: doc.timeQuality || '',
        capability,
        value: reading.value,
        unit: reading.unit || '',
        quality: reading.quality || 'ok',
      });
    }
  }
  return rows;
}

/**
 * Long-format CSV: one row per sensor reading (device, time, capability, value…).
 */
async function exportTelemetryCsv(user, params) {
  const { docs, deviceMap } = await loadTelemetrySamples(user, params);
  const rows = longRowsFromDocs(docs, deviceMap);
  const columns = [
    { header: 'deviceId', value: (r) => r.deviceId },
    { header: 'displayName', value: (r) => r.displayName },
    { header: 'locationName', value: (r) => r.locationName },
    { header: 'ts', value: (r) => r.ts },
    { header: 'sampleId', value: (r) => r.sampleId },
    { header: 'timeQuality', value: (r) => r.timeQuality },
    { header: 'capability', value: (r) => r.capability },
    { header: 'value', value: (r) => r.value },
    { header: 'unit', value: (r) => r.unit },
    { header: 'quality', value: (r) => r.quality },
  ];
  return toCsv(columns, rows);
}

/** Dashboard-style Excel (ХЯНАХ САМБАР + ХЭМЖИЛТҮҮД + ЭХ ӨГӨГДӨЛ). */
async function exportTelemetryWorkbook(user, params) {
  const { docs, deviceMap } = await loadTelemetrySamples(user, params);
  return buildTelemetryWorkbook(docs, deviceMap);
}

async function exportUsersCsv() {
  const users = await User.find({}).sort({ createdAt: -1 }).lean();
  const deviceCounts = await Device.aggregate([
    { $match: { owner: { $ne: null } } },
    { $group: { _id: '$owner', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(deviceCounts.map((row) => [row._id.toString(), row.count]));

  const rows = users.map((u) => ({
    email: u.email,
    name: u.name || '',
    role: u.role,
    canAccessReports: u.reportsAccessUntil && new Date(u.reportsAccessUntil) > new Date() ? 'yes' : 'no',
    reportsAccessUntil: u.reportsAccessUntil ? new Date(u.reportsAccessUntil).toISOString() : '',
    devicesOwned: countMap.get(u._id.toString()) || 0,
    createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : '',
  }));

  const columns = [
    { header: 'email', value: (r) => r.email },
    { header: 'name', value: (r) => r.name },
    { header: 'role', value: (r) => r.role },
    { header: 'canAccessReports', value: (r) => r.canAccessReports },
    { header: 'reportsAccessUntil', value: (r) => r.reportsAccessUntil },
    { header: 'devicesOwned', value: (r) => r.devicesOwned },
    { header: 'createdAt', value: (r) => r.createdAt },
  ];
  return toCsv(columns, rows);
}

module.exports = {
  getFleetSummary,
  listDevicesForReport,
  exportDevicesCsv,
  exportTelemetryCsv,
  exportTelemetryWorkbook,
  exportUsersCsv,
  resolveTelemetryDeviceScope,
};
