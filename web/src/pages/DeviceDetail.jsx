import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Card from '../components/Card';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { LoadingBlock } from '../components/Spinner';
import { CapabilityGrid } from '../features/telemetry/CapabilityWidget';
import TelemetryChart from '../features/telemetry/TelemetryChart';
import AlertsPanel from '../features/telemetry/AlertsPanel';
import DeviceSettingsPanel from '../features/devices/DeviceSettingsPanel';
import TransferForm from '../features/devices/TransferForm';
import * as devicesApi from '../api/devices';
import { useDeviceStore } from '../stores/deviceStore';
import { useUiStore } from '../stores/uiStore';
import { useAuth } from '../hooks/useAuth';
import { useTelemetry } from '../hooks/useTelemetry';
import { addRealtimeListener, subscribeDevice } from '../hooks/useSocket';
import { useI18n } from '../i18n/useI18n';
import { useApiError } from '../i18n/useApiError';
import { isOnline, formatDateTime, formatRelative, STATUS_TONE, deviceStatusLabel } from '../utils/formatters';

/** Roles allowed to revoke/delete a device (mirrors `requireRole` server-side). */
const DESTRUCTIVE_ROLES = ['admin', 'owner'];

function timeQualityLabel(quality, t) {
  if (!quality) return t('deviceDetail.timeQualityUnknown');
  const key = `deviceDetail.timeQuality${quality.charAt(0).toUpperCase()}${quality.slice(1)}`;
  const translated = t(key);
  return translated === key ? quality : translated;
}

export function DeviceDetailPage() {
  const { t, dateLocale } = useI18n();
  const { message: apiError } = useApiError();
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const toast = useUiStore((s) => s.toast);
  const { user } = useAuth();
  const merge = useDeviceStore((s) => s.merge);
  const remove = useDeviceStore((s) => s.remove);

  const [device, setDevice] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [secret, setSecret] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const { latest, live, loading: telemetryLoading } = useTelemetry(deviceId);

  const loadDevice = useCallback(async () => {
    setError(null);
    try {
      const found = await devicesApi.getDevice(deviceId);
      setDevice(found);
      merge(deviceId, found);
      return found;
    } catch (err) {
      setError(err);
      return null;
    }
  }, [deviceId, merge]);

  useEffect(() => {
    setDevice(null);
    loadDevice();
  }, [loadDevice]);

  useEffect(() => subscribeDevice(deviceId, () => {}), [deviceId]);

  useEffect(() => {
    const off = addRealtimeListener((event, payload) => {
      if (!payload || payload.deviceId !== deviceId) return;
      if (event === 'device:deleted') {
        toast(t('deviceDetail.toastDeletedRemote'), 'warn');
        navigate('/devices', { replace: true });
      } else if (event === 'device:revoked') {
        setDevice((prev) => (prev ? { ...prev, status: 'revoked', revokedAt: payload.revokedAt } : prev));
        merge(deviceId, { status: 'revoked', revokedAt: payload.revokedAt });
        toast(t('deviceDetail.toastRevokedRemote'), 'warn');
      } else if (event === 'device:updated') {
        setDevice((prev) =>
          prev
            ? {
                ...prev,
                ...(payload.displayName !== undefined ? { displayName: payload.displayName } : {}),
                ...(payload.locationName !== undefined ? { locationName: payload.locationName } : {}),
                ...(payload.config !== undefined ? { config: payload.config } : {}),
                ...(payload.status !== undefined ? { status: payload.status } : {}),
                ...(payload.owner !== undefined ? { owner: payload.owner } : {}),
              }
            : prev
        );
      } else if (event === 'device:status' && payload.lastSeenAt) {
        setDevice((prev) => (prev ? { ...prev, lastSeenAt: payload.lastSeenAt } : prev));
      }
    });
    return off;
  }, [deviceId, merge, navigate, toast, t]);

  async function save(patch) {
    setSaving(true);
    try {
      const updated = await devicesApi.updateDevice(deviceId, patch);
      setDevice(updated);
      merge(deviceId, updated);
      toast(t('deviceDetail.toastUpdated'), 'ok');
    } finally {
      setSaving(false);
    }
  }

  async function rotate() {
    try {
      const result = await devicesApi.rotateSecret(deviceId);
      setSecret(result.deviceSecret);
      toast(t('deviceDetail.toastSecret'), 'warn');
    } catch (err) {
      toast(apiError(err), 'danger');
    }
  }

  async function transfer(toEmail) {
    try {
      await devicesApi.transferDevice(deviceId, toEmail);
      await loadDevice();
      toast(t('deviceDetail.toastTransferred', { email: toEmail }), 'ok');
    } catch (err) {
      toast(apiError(err), 'danger');
    }
  }

  async function revoke() {
    try {
      await devicesApi.revokeDevice(deviceId);
      await loadDevice();
      toast(t('deviceDetail.toastRevoked'), 'warn');
    } catch (err) {
      toast(apiError(err), 'danger');
    } finally {
      setConfirm(null);
    }
  }

  async function destroy() {
    try {
      await devicesApi.deleteDevice(deviceId);
      remove(deviceId);
      toast(t('deviceDetail.toastDeleted'), 'ok');
      navigate('/devices', { replace: true });
    } catch (err) {
      toast(apiError(err), 'danger');
    } finally {
      setConfirm(null);
    }
  }

  if (error) {
    return (
      <EmptyState
        icon="🚫"
        title={error.status === 404 ? t('deviceDetail.notFound') : t('deviceDetail.loadFailed')}
        hint={error.status === 404 ? t('deviceDetail.notFoundHint') : apiError(error)}
        action={
          <Link className="button button--primary" to="/devices">
            {t('deviceDetail.backToDevices')}
          </Link>
        }
      />
    );
  }

  if (!device) return <LoadingBlock label={t('deviceDetail.loading')} />;

  const online = isOnline(device.lastSeenAt);
  const canDestroy = DESTRUCTIVE_ROLES.includes(user?.role);

  return (
    <>
      <header className="page-header">
        <div>
          <p className="breadcrumb">
            <Link to="/devices">{t('devices.title')}</Link> / {device.displayName || device.deviceId}
          </p>
          <h1>{device.displayName || device.deviceId}</h1>
          <p className="muted">
            <code>{device.deviceId}</code> · {device.model} · {t('deviceDetail.metaFw', { version: device.firmwareVersion })} ·{' '}
            {device.locationName || t('devices.noLocation')}
          </p>
        </div>

        <div className="page-header__actions">
          <Badge tone={online ? 'ok' : 'warn'}>{online ? t('common.online') : t('common.offline')}</Badge>
          <Badge tone={STATUS_TONE[device.status] || 'neutral'}>{deviceStatusLabel(device.status, t)}</Badge>
          <span className="muted">
            {t('devices.lastSeen')} {formatRelative(device.lastSeenAt, t, dateLocale)}
          </span>
        </div>
      </header>

      <Card title={t('deviceDetail.liveTitle')} subtitle={t('deviceDetail.liveSubtitle')}>
        {telemetryLoading && live.length === 0 ? (
          <LoadingBlock label={t('deviceDetail.loadingReadings')} />
        ) : latest ? (
          <>
            <CapabilityGrid capabilities={device.capabilities} latest={latest} live={live} />
            <p className="muted">
              {t('deviceDetail.sampleAt', { time: formatDateTime(latest.ts, dateLocale) })} · {t('deviceDetail.timeQualityLabel')}{' '}
              <strong>{timeQualityLabel(latest.timeQuality, t)}</strong>
            </p>
          </>
        ) : (
          <EmptyState icon="⏳" title={t('deviceDetail.noTelemetryTitle')} hint={t('deviceDetail.noTelemetryHint')} />
        )}
      </Card>

      <TelemetryChart deviceId={device.deviceId} capabilities={device.capabilities} />

      <AlertsPanel deviceId={device.deviceId} capabilities={device.capabilities} />

      <DeviceSettingsPanel device={device} onSave={save} saving={saving} />

      <div className="two-col">
        <Card
          title={t('deviceDetail.credentialsTitle')}
          subtitle={t('deviceDetail.credentialsSubtitle')}
          actions={
            <button type="button" className="button button--ghost" onClick={rotate}>
              {t('deviceDetail.rotateSecret')}
            </button>
          }
        >
          <p className="muted">{t('deviceDetail.credentialsHint')}</p>
          <TransferForm onTransfer={transfer} />
        </Card>

        {canDestroy ? (
          <Card title={t('deviceDetail.dangerTitle')} subtitle={t('deviceDetail.dangerSubtitle')}>
            <div className="button-row">
              <button type="button" className="button button--ghost" onClick={() => setConfirm('revoke')}>
                {t('deviceDetail.revoke')}
              </button>
              <button type="button" className="button button--danger" onClick={() => setConfirm('delete')}>
                {t('deviceDetail.delete')}
              </button>
            </div>
            <p className="muted">{t('deviceDetail.dangerHint')}</p>
          </Card>
        ) : (
          <Card title={t('deviceDetail.dangerRestrictedTitle')} subtitle={t('deviceDetail.dangerRestrictedSubtitle')}>
            <p className="muted">{t('deviceDetail.dangerRestrictedBody')}</p>
          </Card>
        )}
      </div>

      <Modal open={Boolean(secret)} onClose={() => setSecret(null)} title={t('deviceDetail.secretModalTitle')}>
        <p className="form__hint">{t('deviceDetail.secretModalHint')}</p>
        <pre className="code-block">{secret}</pre>
        <button type="button" className="button button--primary" onClick={() => setSecret(null)}>
          {t('deviceDetail.secretStored')}
        </button>
      </Modal>

      <Modal
        open={confirm === 'revoke'}
        onClose={() => setConfirm(null)}
        title={t('deviceDetail.revokeModalTitle')}
        footer={
          <>
            <button type="button" className="button button--ghost" onClick={() => setConfirm(null)}>
              {t('common.cancel')}
            </button>
            <button type="button" className="button button--danger" onClick={revoke}>
              {t('deviceDetail.revokeConfirm')}
            </button>
          </>
        }
      >
        <p>{t('deviceDetail.revokeModalBody')}</p>
      </Modal>

      <Modal
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        title={t('deviceDetail.deleteModalTitle')}
        footer={
          <>
            <button type="button" className="button button--ghost" onClick={() => setConfirm(null)}>
              {t('common.cancel')}
            </button>
            <button type="button" className="button button--danger" onClick={destroy}>
              {t('deviceDetail.deleteConfirmPerm')}
            </button>
          </>
        }
      >
        <p>{t('deviceDetail.deleteModalBody')}</p>
      </Modal>
    </>
  );
}

export default DeviceDetailPage;
