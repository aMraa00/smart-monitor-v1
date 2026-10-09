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
import { ONLINE_WINDOW_MS, formatRelative, isOnline } from '../utils/formatters';

/** How fresh "live" is before the UI admits the stream went quiet. */
const STALE_AFTER_MS = 45_000;

const TIME_TONE = { ntp: 'ok', synced: 'warn', estimated: 'danger' };

/**
 * Landing page: fleet health at a glance plus the live readings of the
 * currently selected station.
 *
 * The tile grid is generated from `device.capabilities`, so a station with a
 * different sensor set renders itself without any change here (§10.2).
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
      load().catch(() => {
        /* surfaced by the store */
      });
    }
  }, [devices.length, load]);

  // Ticks the staleness indicator only (cheap: one render per second).
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

  // Fall back to the first device whenever the selection disappears.
  useEffect(() => {
    if (!selectedId && filtered.length > 0) setSelectedId(filtered[0].deviceId);
    if (selectedId && filtered.length > 0 && !filtered.some((d) => d.deviceId === selectedId)) {
      setSelectedId(filtered[0].deviceId);
    }
  }, [filtered, selectedId]);

  const selected = useMemo(() => devices.find((d) => d.deviceId === selectedId) || null, [devices, selectedId]);
  const { latest, live, loading: telemetryLoading } = useTelemetry(selected?.deviceId);

  // Subscribe the dashboard itself: a tile update must not depend on the
  // device page being open somewhere else.
  useEffect(() => subscribeDevice(selectedId, () => {}), [selectedId]);

  // Alert transitions are worth interrupting for, once per firing alert.
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
  const warnCount = devices.filter((d) => d.status !== 'active' && d.status !== 'revoked').length;
  const capabilityCount = devices.reduce((total, d) => total + (d.capabilities?.length || 0), 0);

  // --- stream freshness: latest sample age drives the "LIVE" indicator -------
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
        hint="You have no stations yet. Claim your first device to start seeing live environmental data."
        action={
          <Link className="button button--primary" to="/devices">
            Go to devices
          </Link>
        }
      />
    );
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Fleet overview and live readings</p>
        </div>

        <div className="page-header__actions">
          <input
            className="input"
            type="search"
            placeholder="Filter stations…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter stations"
          />
          <label className="field field--inline">
            <span className="sr-only">Device</span>
            <select className="select" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {filtered.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.displayName || device.deviceId}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div className="stat-row">
        <Card className="stat-card">
          <span className="stat-card__label">Stations</span>
          <strong className="stat-card__value">{devices.length}</strong>
        </Card>
        <Card className="stat-card">
          <span className="stat-card__label">Reporting now</span>
          <strong className="stat-card__value">{onlineCount}</strong>
        </Card>
        <Card className="stat-card">
          <span className="stat-card__label">Capabilities</span>
          <strong className="stat-card__value">{capabilityCount}</strong>
        </Card>
        <Card className="stat-card">
          <span className="stat-card__label">Selected</span>
          <strong className="stat-card__value stat-card__value--small">
            {selected ? (selected.displayName || selected.deviceId) : '—'}
          </strong>
        </Card>
      </div>

      {selected && (
        <Card
          title={selected.displayName || selected.deviceId}
          subtitle={`${selected.locationName || 'No location'} · last seen ${formatRelative(selected.lastSeenAt)}`}
          actions={<Badge tone={isOnline(selected.lastSeenAt) ? 'ok' : 'warn'}>{isOnline(selected.lastSeenAt) ? 'online' : 'offline'}</Badge>}
        >
          {telemetryLoading && live.length === 0 ? (
            <LoadingBlock label="Loading readings" />
          ) : latest ? (
            <>
              <CapabilityGrid capabilities={selected.capabilities} latest={latest} live={live} />
              <p className="muted">
                time quality: <strong>{latest.timeQuality || 'unknown'}</strong> · sample{' '}
                {formatRelative(latest.ts)}
              </p>
            </>
          ) : (
            <EmptyState
              icon="⏳"
              title="No telemetry yet"
              hint="The station is registered but has not delivered a sample. Check its Wi-Fi or wait for the next upload."
            />
          )}
          <p>
            <Link to={`/devices/${selected.deviceId}`}>Open device →</Link>
          </p>
        </Card>
      )}
    </>
  );
}

export default DashboardPage;
