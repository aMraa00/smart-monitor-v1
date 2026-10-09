'use strict';

const path = require('path');
const ExcelJS = require('exceljs');
const { sampleToWideRow, sampleToLongRows } = require('../utils/telemetryExportFormat');

const TEMPLATE_PATH = path.join(__dirname, '../../assets/telemetry-dashboard.template.xlsx');
const SHEET_MEASUREMENTS = 'ХЭМЖИЛТҮҮД';
const SHEET_RAW = 'ЭХ ӨГӨГДӨЛ';
const TABLE_MEASUREMENTS = 'TelemetrySamples';
const TABLE_RAW = 'RawTelemetry';

function clearRowsFrom(worksheet, startRow) {
  const last = worksheet.lastRow ? worksheet.lastRow.number : startRow - 1;
  if (last >= startRow) worksheet.spliceRows(startRow, last - startRow + 1);
}

function columnLetter(index) {
  let n = index;
  let label = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

function resizeTable(worksheet, tableName, colCount, rowCount) {
  try {
    const table = worksheet.getTable(tableName);
    if (!table) return;
    table.ref = `A1:${columnLetter(colCount)}${rowCount}`;
    table.commit();
  } catch {
    /* non-fatal if the template table metadata differs */
  }
}

/**
 * Fill Smart Monitor dashboard workbook (charts + «ХЭМЖИЛТҮҮД» + «ЭХ ӨГӨГДӨЛ»).
 * @param {object[]} docs telemetry samples (sorted)
 * @param {Map<string, object>} deviceMap
 */
async function buildTelemetryWorkbook(docs, deviceMap) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_PATH);

  const wsWide = workbook.getWorksheet(SHEET_MEASUREMENTS);
  const wsRaw = workbook.getWorksheet(SHEET_RAW);
  if (!wsWide || !wsRaw) {
    throw new Error('Telemetry dashboard template is missing required worksheets');
  }

  clearRowsFrom(wsWide, 2);
  clearRowsFrom(wsRaw, 2);

  const wideRows = [];
  const longRows = [];
  for (const doc of docs) {
    const meta = deviceMap.get(String(doc.device));
    wideRows.push(sampleToWideRow(doc, meta));
    longRows.push(...sampleToLongRows(doc, meta));
  }

  for (const row of wideRows) wsWide.addRow(row);
  for (const row of longRows) wsRaw.addRow(row);

  const wideCount = Math.max(1, wideRows.length + 1);
  const rawCount = Math.max(1, longRows.length + 1);
  resizeTable(wsWide, TABLE_MEASUREMENTS, 11, wideCount);
  resizeTable(wsRaw, TABLE_RAW, 10, rawCount);

  return workbook.xlsx.writeBuffer();
}

module.exports = { buildTelemetryWorkbook, TEMPLATE_PATH };
