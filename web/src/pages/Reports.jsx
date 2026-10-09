import { useCallback, useEffect, useState } from 'react';
import Card from '../components/Card';
import { LoadingBlock } from '../components/Spinner';
import { fetchReportSummary, downloadReportCsv } from '../api/reports';
import { ReportExportPanel } from '../features/reports/ReportExportPanel';
import { useI18n } from '../i18n/useI18n';
import { useApiError } from '../i18n/useApiError';
import { useUiStore } from '../stores/uiStore';
import { useAuth } from '../hooks/useAuth';
import { formatReportsUntil } from '../utils/reportsAccess';

export function ReportsPage() {
  const { t, dateLocale } = useI18n();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { message: apiError } = useApiError();
  const toast = useUiStore((s) => s.toast);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSummary(await fetchReportSummary());
    } catch (err) {
      toast(apiError(err), 'danger');
    } finally {
      setLoading(false);
    }
  }, [apiError, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDownload(kind) {
    setDownloading(kind);
    try {
      await downloadReportCsv(kind);
      toast(t('reports.downloadOk'), 'ok');
    } catch (err) {
      toast(apiError(err), 'danger');
    } finally {
      setDownloading('');
    }
  }

  if (loading && !summary) return <LoadingBlock label={t('reports.loading')} />;

  const devices = summary?.devices || {};
  const users = summary?.users || {};

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{t('reports.title')}</h1>
          <p className="muted">
            {isAdmin
              ? t('reports.subtitle')
              : `${t('reports.subtitle')} · ${formatReportsUntil(user?.reportsAccessUntil, t, dateLocale)}`}
          </p>
        </div>
      </header>

      {summary && (
        <div className="stat-row">
          <Card className="stat-card">
            <div className="card__body">
              <span className="stat-card__label">{t('reports.statDevices')}</span>
              <span className="stat-card__value">{devices.total ?? 0}</span>
            </div>
          </Card>
          <Card className="stat-card">
            <div className="card__body">
              <span className="stat-card__label">{t('reports.statLive')}</span>
              <span className="stat-card__value">{devices.withLatestTelemetry ?? 0}</span>
            </div>
          </Card>
          {isAdmin && (
            <>
              <Card className="stat-card">
                <div className="card__body">
                  <span className="stat-card__label">{t('reports.statUsers')}</span>
                  <span className="stat-card__value">{users.total ?? 0}</span>
                </div>
              </Card>
              <Card className="stat-card">
                <div className="card__body">
                  <span className="stat-card__label">{t('reports.statReportAccess')}</span>
                  <span className="stat-card__value">{users.withReportAccess ?? 0}</span>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      <Card title={t('reports.sensorTitle')} subtitle={t('reports.sensorHint')}>
        <ReportExportPanel />
      </Card>

      <Card title={t('reports.exportTitle')} subtitle={t('reports.exportHint')}>
        <div className="button-row">
          <button
            type="button"
            className="button button--secondary"
            disabled={Boolean(downloading)}
            onClick={() => handleDownload('devices')}
          >
            {downloading === 'devices' ? t('reports.downloading') : t('reports.downloadDevices')}
          </button>
          {isAdmin && (
            <button
              type="button"
              className="button button--secondary"
              disabled={Boolean(downloading)}
              onClick={() => handleDownload('users')}
            >
              {downloading === 'users' ? t('reports.downloading') : t('reports.downloadUsers')}
            </button>
          )}
        </div>
        <p className="muted">{t('reports.csvNote')}</p>
      </Card>

      {isAdmin && summary && (
        <div className="two-col">
          <Card title={t('reports.byStatus')}>
            <ul className="detail-list">
              {Object.entries(devices.byStatus || {}).map(([status, count]) => (
                <div key={status}>
                  <dt>{status}</dt>
                  <dd>{count}</dd>
                </div>
              ))}
            </ul>
          </Card>
          <Card title={t('reports.byRole')}>
            <ul className="detail-list">
              {Object.entries(users.byRole || {}).map(([role, count]) => (
                <div key={role}>
                  <dt>{role}</dt>
                  <dd>{count}</dd>
                </div>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}

export default ReportsPage;
