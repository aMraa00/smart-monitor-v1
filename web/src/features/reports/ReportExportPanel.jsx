import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchReportDevices, downloadReportCsv } from '../../api/reports';
import { useI18n } from '../../i18n/useI18n';
import { useApiError } from '../../i18n/useApiError';
import { useUiStore } from '../../stores/uiStore';

function defaultRangeDays(days) {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

/**
 * Sensor CSV export controls (station + date range).
 * Shown on Reports, Settings (entitled users), and Users (admin).
 */
export function ReportExportPanel({ showNote = true }) {
  const { t } = useI18n();
  const { message: apiError } = useApiError();
  const toast = useUiStore((s) => s.toast);
  const [deviceRows, setDeviceRows] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [range, setRange] = useState(() => defaultRangeDays(7));

  const loadDevices = useCallback(async () => {
    setLoadingDevices(true);
    try {
      setDeviceRows(await fetchReportDevices());
    } catch (err) {
      toast(apiError(err), 'danger');
    } finally {
      setLoadingDevices(false);
    }
  }, [apiError, toast]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const exportQuery = useMemo(
    () => ({
      deviceId: deviceId || undefined,
      from: range.from ? `${range.from}T00:00:00.000Z` : undefined,
      to: range.to ? `${range.to}T23:59:59.999Z` : undefined,
    }),
    [deviceId, range.from, range.to]
  );

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadReportCsv('telemetryWorkbook', exportQuery);
      toast(t('reports.downloadOk'), 'ok');
    } catch (err) {
      toast(apiError(err), 'danger');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <div className="form__grid">
        <label className="field">
          <span>{t('reports.deviceFilter')}</span>
          <select
            className="select"
            value={deviceId}
            disabled={loadingDevices}
            onChange={(e) => setDeviceId(e.target.value)}
          >
            <option value="">{t('reports.deviceAll')}</option>
            {deviceRows.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.displayName ? `${d.displayName} (${d.deviceId})` : d.deviceId}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('reports.fromDate')}</span>
          <input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
        </label>
        <label className="field">
          <span>{t('reports.toDate')}</span>
          <input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
        </label>
      </div>
      <div className="button-row">
        <button type="button" className="button button--primary" disabled={downloading || loadingDevices} onClick={handleDownload}>
          {downloading ? t('reports.downloading') : t('reports.downloadTelemetry')}
        </button>
      </div>
      {showNote && <p className="muted">{t('reports.telemetryNote')}</p>}
    </>
  );
}

export default ReportExportPanel;
