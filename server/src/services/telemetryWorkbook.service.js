'use strict';

const path = require('path');
const ApiError = require('../utils/apiError');
const { sampleToWideRow, sampleToLongRows } = require('../utils/telemetryExportFormat');

let ExcelJS;
try {
  ExcelJS = require('exceljs');
} catch {
  ExcelJS = null;
}

const TEMPLATE_PATH = path.join(__dirname, '../../assets/telemetry-dashboard.template.xlsx');
const SHEET_DASHBOARD = 'ХЯНАХ САМБАР';
const SHEET_MEASUREMENTS = 'ХЭМЖИЛТҮҮД';
const SHEET_RAW = 'ЭХ ӨГӨГДӨЛ';
const SHEET_HELP = 'ТАЙЛБАР';

const WIDE_HEADERS = [
  'Огноо, цаг (UTC)',
  'Төхөөрөмж',
  'Цагийн чанар',
  'Температур (°C)',
  'Чийгшил (%)',
  'Даралт (hPa)',
  'Гэрэлтүүлэг (lx)',
  'eCO₂ (ppm)',
  'TVOC (ppb)',
  'Салхины эргэлт (rpm)',
  'Салхины хурд (м/с)',
];

const RAW_HEADERS = [
  'deviceId',
  'displayName',
  'locationName',
  'ts',
  'sampleId',
  'timeQuality',
  'capability',
  'value',
  'unit',
  'quality',
];

function styleHeaderRow(row) {
  row.font = { bold: true };
  row.alignment = { vertical: 'middle', wrapText: true };
}

/** Build dashboard workbook (ExcelJS cannot reliably load the chart-heavy template). */
function buildWorkbookProgrammatic(docs, deviceMap) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Smart Monitor';
  workbook.created = new Date();

  const wsDash = workbook.addWorksheet(SHEET_DASHBOARD);
  wsDash.addRow(['Smart Monitor — Telemetry Dashboard']);
  wsDash.addRow(['Generated (UTC)', new Date().toISOString()]);
  wsDash.addRow(['Samples in export', docs.length]);
  wsDash.addRow([]);
  wsDash.addRow(['«ХЭМЖИЛТҮҮД» хүснэгтэд мэдрэгчийн өгөгдөл байна.']);
  wsDash.addRow(['«ЭХ ӨГӨГДӨЛ» — нэг мөр бүр нэг уншилт (raw).']);

  const wsWide = workbook.addWorksheet(SHEET_MEASUREMENTS);
  styleHeaderRow(wsWide.addRow(WIDE_HEADERS));
  wsWide.views = [{ state: 'frozen', ySplit: 1 }];
  for (const doc of docs) {
    const meta = deviceMap.get(String(doc.device));
    wsWide.addRow(sampleToWideRow(doc, meta));
  }
  wsWide.columns.forEach((col) => {
    col.width = 18;
  });
  wsWide.getColumn(1).width = 22;

  const wsRaw = workbook.addWorksheet(SHEET_RAW);
  styleHeaderRow(wsRaw.addRow(RAW_HEADERS));
  wsRaw.views = [{ state: 'frozen', ySplit: 1 }];
  for (const doc of docs) {
    const meta = deviceMap.get(String(doc.device));
    for (const row of sampleToLongRows(doc, meta)) wsRaw.addRow(row);
  }
  wsRaw.columns.forEach((col) => {
    col.width = 16;
  });
  wsRaw.getColumn(4).width = 24;

  const wsHelp = workbook.addWorksheet(SHEET_HELP);
  wsHelp.addRow(['Тайлбар']);
  wsHelp.addRow(['Энэ файлыг Smart Monitor вебээс автоматаар үүсгэсэн.']);
  wsHelp.addRow(['Даралт: Pa → hPa хөрвүүлсэн (шаблонтой ижил).']);
  wsHelp.addRow(['Хугацаа: UTC.']);

  return workbook;
}

async function buildTelemetryWorkbook(docs, deviceMap) {
  if (!ExcelJS) {
    throw new ApiError(
      500,
      'REPORT_ENGINE_MISSING',
      'Excel export is not available on this server (exceljs not installed)'
    );
  }

  const workbook = buildWorkbookProgrammatic(docs, deviceMap);
  try {
    return await workbook.xlsx.writeBuffer();
  } catch (err) {
    throw new ApiError(500, 'REPORT_WRITE_FAILED', err.message || 'Cannot write report file');
  }
}

module.exports = { buildTelemetryWorkbook, TEMPLATE_PATH };
