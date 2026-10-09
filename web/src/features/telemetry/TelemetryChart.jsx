import { useCallback, useEffect, useState } from 'react';
import Card from '../../components/Card';
import LineChart from '../../components/LineChart';
import { LoadingBlock } from '../../components/Spinner';
import { fetchHistory } from '../../api/telemetry';
import { addRealtimeListener } from '../../hooks/useSocket';
import { describeCapabilityI18n, orderCapabilities } from '../../utils/capabilities';
import { useI18n } from '../../i18n/useI18n';
import { useApiError } from '../../i18n/useApiError';

const RANGES = [
  { key: '6h', labelKey: 'deviceDetail.range6h', hours: 6, bucket: 'raw', bucketKey: 'deviceDetail.bucketRaw' },
  { key: '24h', labelKey: 'deviceDetail.range24h', hours: 24, bucket: 'minute', bucketKey: 'deviceDetail.bucketMinute' },
  { key: '7d', labelKey: 'deviceDetail.range7d', hours: 24 * 7, bucket: 'hour', bucketKey: 'deviceDetail.bucketHour' },
  { key: '30d', labelKey: 'deviceDetail.range30d', hours: 24 * 30, bucket: 'day', bucketKey: 'deviceDetail.bucketDay' },
];

export function TelemetryChart({ deviceId, capabilities = [] }) {
  const { t } = useI18n();
  const { message: apiError } = useApiError();
  const capabilitiesList = orderCapabilities(capabilities);
  const [capability, setCapability] = useState(capabilitiesList[0] || '');
  const [rangeKey, setRangeKey] = useState('6h');
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const range = RANGES.find((r) => r.key === rangeKey) || RANGES[0];

  useEffect(() => {
    if (capabilitiesList.length > 0 && !capabilitiesList.includes(capability)) {
      setCapability(capabilitiesList[0]);
    }
  }, [capabilitiesList, capability]);

  const load = useCallback(async () => {
    if (!deviceId || !capability) {
      setHistory(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const to = new Date();
      const from = new Date(to.getTime() - range.hours * 60 * 60 * 1000);
      const data = await fetchHistory(deviceId, {
        from: from.toISOString(),
        to: to.toISOString(),
        capability,
        bucket: range.bucket,
        limit: 500,
      });
      setHistory(data);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [deviceId, capability, range.hours, range.bucket]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (range.bucket !== 'raw') return undefined;
    let timer = null;
    const off = addRealtimeListener((event, payload) => {
      if (event !== 'telemetry:new' || payload?.deviceId !== deviceId) return;
      if (timer) return;
      timer = window.setTimeout(() => {
        timer = null;
        load();
      }, 3000);
    });
    return () => {
      if (timer) window.clearTimeout(timer);
      off();
    };
  }, [deviceId, range.bucket, load]);

  const meta = describeCapabilityI18n(capability, t);
  const points = history && history.series[0] ? history.series[0].points : [];
  const bucketLabel = t(history?.bucket ? `deviceDetail.bucket${history.bucket.charAt(0).toUpperCase()}${history.bucket.slice(1)}` : range.bucketKey);
  const rangeLabel = t(range.labelKey);

  return (
    <Card
      title={t('deviceDetail.historyTitle')}
      subtitle={
        capability
          ? t('deviceDetail.historySubtitle', {
              capability: meta.label,
              range: rangeLabel,
              bucket: bucketLabel,
            })
          : t('deviceDetail.historyNoCap')
      }
      actions={
        <div className="control-row">
          <select
            className="select"
            value={capability}
            onChange={(e) => setCapability(e.target.value)}
            aria-label={t('deviceDetail.capabilityAria')}
          >
            {capabilitiesList.map((name) => (
              <option key={name} value={name}>
                {describeCapabilityI18n(name, t).label}
              </option>
            ))}
          </select>

          <div className="segmented" role="group" aria-label={t('deviceDetail.rangeAria')}>
            {RANGES.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`segmented__item ${item.key === rangeKey ? 'segmented__item--active' : ''}`.trim()}
                onClick={() => setRangeKey(item.key)}
              >
                {t(item.labelKey)}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {error && <p className="form__error">{error}</p>}
      {!capability ? (
        <p className="muted">{t('deviceDetail.historyNoCap')}</p>
      ) : loading && !history ? (
        <LoadingBlock label={t('deviceDetail.historyLoading')} />
      ) : (
        <LineChart
          points={points}
          color={meta.color}
          unit={capability === 'pressure' ? 'Pa' : meta.unit}
          decimals={meta.decimals}
          bucket={history?.bucket || range.bucket}
          emptyLabel={t('deviceDetail.historyEmptyChart')}
          height={220}
        />
      )}
    </Card>
  );
}

export default TelemetryChart;
