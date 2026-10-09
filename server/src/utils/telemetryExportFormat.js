'use strict';

/** Wide-sheet columns on «ХЭМЖИЛТҮҮД» (matches dashboard template). */
const WIDE_CAPABILITY_KEYS = [
  'temperature',
  'humidity',
  'pressure',
  'illuminance',
  'eco2',
  'tvoc',
  'wind_rpm',
  'wind_speed',
];

function normalizeCapabilities(caps) {
  if (!caps) return {};
  if (caps instanceof Map) return Object.fromEntries(caps.entries());
  return caps;
}

function formatTsUtc(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/** Template uses hPa; stored readings may be Pa. */
function pressureForDashboard(value, unit) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  if (unit === 'hPa') return value;
  if (unit === 'Pa' || value > 5000) return Math.round((value / 100) * 100) / 100;
  return value;
}

function readingValue(caps, key) {
  const reading = caps[key];
  if (!reading || typeof reading.value !== 'number') return '';
  if (key === 'pressure') return pressureForDashboard(reading.value, reading.unit);
  return reading.value;
}

function sampleToWideRow(doc, meta) {
  const caps = normalizeCapabilities(doc.capabilities);
  return [
    formatTsUtc(doc.ts),
    meta?.deviceId || doc.deviceId || '',
    doc.timeQuality || '',
    ...WIDE_CAPABILITY_KEYS.map((key) => readingValue(caps, key)),
  ];
}

function sampleToLongRows(doc, meta) {
  const caps = normalizeCapabilities(doc.capabilities);
  const rows = [];
  for (const [capability, reading] of Object.entries(caps)) {
    if (!reading || typeof reading.value !== 'number') continue;
    rows.push([
      meta?.deviceId || doc.deviceId || '',
      meta?.displayName || '',
      meta?.locationName || '',
      doc.ts ? new Date(doc.ts).toISOString() : '',
      doc.sampleId || '',
      doc.timeQuality || '',
      capability,
      reading.value,
      reading.unit || '',
      reading.quality || 'ok',
    ]);
  }
  return rows;
}

module.exports = {
  WIDE_CAPABILITY_KEYS,
  formatTsUtc,
  sampleToWideRow,
  sampleToLongRows,
};
