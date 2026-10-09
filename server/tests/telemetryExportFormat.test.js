'use strict';

const { sampleToWideRow, formatTsUtc } = require('../src/utils/telemetryExportFormat');

describe('telemetryExportFormat', () => {
  test('formatTsUtc matches dashboard template', () => {
    expect(formatTsUtc('2026-10-09T18:53:00.000Z')).toBe('2026-10-09 18:53:00');
  });

  test('wide row converts Pa pressure to hPa', () => {
    const row = sampleToWideRow(
      {
        ts: new Date('2026-10-09T18:53:00.000Z'),
        deviceId: 'SMV1-TEST',
        timeQuality: 'ntp',
        capabilities: {
          temperature: { value: 27.1, unit: '°C' },
          pressure: { value: 86121, unit: 'Pa' },
        },
      },
      { deviceId: 'SMV1-TEST' }
    );
    expect(row[0]).toBe('2026-10-09 18:53:00');
    expect(row[1]).toBe('SMV1-TEST');
    expect(row[5]).toBe(861.21);
  });
});
