import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../components/Card';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import { LoadingBlock } from '../components/Spinner';
import { CapabilityGrid } from '../features/telemetry/CapabilityWidget';
import { useDeviceStore } from '../stores/deviceStore';
import { useUiStore } from '../stores/uiStore';
import { useTelemetry } from '../hooks/useTelemetry';
import { addRealtimeListener, subscribeDevice } from '../hooks/useSocket';
import { useDebounce } from '../hooks/useDebounce';
import { describeCapability } from '../utils/capabilities';
import { formatRelative, isOnline } from '../utils/formatters';

/** How fresh "live" is before the UI admits the stream went quiet. */
const STALE_AFTER_MS = 45_000;

const TIME_TONE = { ntp: 'ok', synced: 'warn', estimated: 'danger' };

/**
 * Landing page: fleet health at a glance plus the live readings of the
 * currently selected station.
 */
export function DashboardPage() {
  const { devices, loading, load } = useDeviceStore();
  const toast = useUiStore((s) => s.toast);
  const socketState = useUiStore((s) => s.socketState);
  const [selectedId, setSelectedId] = useState('');
  const [filter, setFilter] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const debouncedFilter = useDebounce(filter.trim().toLowerCase(), 200);

  useEffect(() => {
    if (devices.length === 0) {
      load().catch(() => {});
    }
  }, [devices.length, load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const filtered = useMemo(() => {
    if (!debouncedFilter) return devices;
    return devices.filter((device) =>
      [device.displayName, device.deviceId, device.locationName, device.model]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(debouncedFilter))
    );
  }, [devices, debouncedFilter]);

  useEffect(() => {
    if (!selectedId && filtered.length > 0) setSelectedId(filtered[0].deviceId);
    if (selectedId && filtered.length > 0 && !filtered.some((d) => d.deviceId === selectedId)) {
      setSelectedId(filtered[0].deviceId);
    }
  }, [filtered, selectedId]);

  const selected = useMemo(() => devices.find((d) => d.deviceId === selectedId) || null, [devices, selectedId]);
  const { latest, live, loading: telemetryLoading } = useTelemetry(selected?.deviceId);
  const sampleIntervalS = selected?.config?.sampleIntervalS ?? 60;

  useEffect(() => subscribeDevice(selectedId, () => {}), [selectedId]);

  useEffect(() => {
    const seen = new Set();
    const off = addRealtimeListener((event, payload) => {
      if (event !== 'alert:raised' || !payload) return;
      const key = payload.alertId || `${payload.deviceId}:${payload.capability}:${payload.startedAt}`;
      if (seen.has(key)) return;
      seen.add(key);
      const label = describeCapability(payload.capability).label;
      toast(`Alert: ${label} ${payload.value} (${payload.severity})`, 'danger', 8000);
    });
    return off;
  }, [toast]);

  const onlineCount = devices.filter((d) => isOnline(d.lastSeenAt)).length;

  const latestTs = latest ? new Date(latest.ts).getTime() : NaN;
  const streamAgeMs = Number.isFinite(latestTs) ? Math.max(0, now - latestTs) : NaN;
  const streamFresh = Number.isFinite(streamAgeMs) && streamAgeMs <= STALE_AFTER_MS;
  const streamStale = Number.isFinite(streamAgeMs) && streamAgeMs > STALE_AFTER_MS;
  const deviceOnline = selected ? isOnline(selected.lastSeenAt) : false;

  if (loading && devices.length === 0) return <LoadingBlock label="Loading dashboard" />;

  if (devices.length === 0) {
    return (
      <EmptyState
        icon="🏁"
        title="Welcome to Smart Monitor"
        hint="Claim your first station to see live air quality and weather readings here."
        action={
          <Link className="button button--primary" to="/devices">
            Claim a device
          </Link>
        }
      />
    );
  }

  const displayName = selected ? selected.displayName || selected.deviceId : '—';

  return (
    <>
      <header className="page-header page-header--dashboard">
        <div>
          <h1>Live</h1>
          <p className="muted page-header__lede">
            {onlineCount}/{devices.length} stations reporting · ~{sampleIntervalS}s refresh
          </p>
        </div>
        <div className="page-header__actions page-header__actions--stack">
          <input
            className="input input--search"
            type="search"
            placeholder="Search stations…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Search stations"
          />
        </div>
      </header>

      {filtered.length > 1 && (
        <div className="device-chips" role="tablist" aria-label="Select station">
          {filtered.map((device) => {
            const active = device.deviceId === selectedId;
            const online = isOnline(device.lastSeenAt);
            return (
              <button
                key={device.deviceId}
                type="button"
                role="tab"
                aria-selected={active}
                className={`device-chip ${active ? 'device-chip--active' : ''}`.trim()}
                onClick={() => setSelectedId(device.deviceId)}
              >
                <span className={`device-chip__dot ${online ? 'device-chip__dot--ok' : ''}`.trim()} aria-hidden="true" />
                {device.displayName || device.deviceId.replace('SMV1-', '…')}
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <section className="live-hero" aria-live="polite">
          <div className="live-hero__main">
            <p className="live-hero__eyebrow">{selected.locationName || 'My station'}</p>
            <h2 className="live-hero__title">{displayName}</h2>
            <p className="live-hero__meta muted">
              Last seen {formatRelative(selected.lastSeenAt)}
              {latest?.ts ? ` · sample ${formatRelative(latest.ts)}` : ''}
            </p>
          </div>
          <div className="live-hero__badges">
            <Badge tone={deviceOnline ? 'ok' : 'warn'}>{deviceOnline ? 'online' : 'offline'}</Badge>
            <Badge tone={socketState === 'online' ? 'ok' : socketState === 'connecting' ? 'warn' : 'danger'}>
              {socketState === 'online' ? 'socket live' : socketState}
            </Badge>
            {latest && (
              <Badge tone={streamFresh ? 'ok' : streamStale ? 'warn' : 'neutral'}>
                {streamFresh ? 'streaming' : streamStale ? 'quiet' : 'waiting'}
              </Badge>
            )}
          </div>
        </section>
      )}

      {selected && (
        <Card className="card--flush-mobile">
          {telemetryLoading && live.length === 0 ? (
            <LoadingBlock label="Loading readings" />
          ) : latest ? (
            <>
              <CapabilityGrid capabilities={selected.capabilities} latest={latest} live={live} />
              <div className="sample-meta">
                <span>
                  Time quality{' '}
                  <Badge tone={TIME_TONE[latest.timeQuality] || 'neutral'}>{latest.timeQuality || 'unknown'}</Badge>
                </span>
                <span className="muted">New sample about every {sampleIntervalS}s</span>
              </div>
            </>
          ) : (
            <EmptyState
              icon="⏳"
              title="Waiting for first sample"
              hint="Check Wi‑Fi on the station. The dashboard updates automatically when data arrives."
            />
          )}
          <Link className="button button--secondary button--block-mobile" to={`/devices/${selected.deviceId}`}>
            Charts &amp; settings
          </Link>
        </Card>
      )}
    </>
  );
}

export default DashboardPage;
