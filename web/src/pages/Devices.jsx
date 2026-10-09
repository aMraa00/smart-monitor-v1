import { useEffect, useState } from 'react';
import DeviceCard from '../features/devices/DeviceCard';
import ClaimDeviceModal from '../features/devices/ClaimDeviceModal';
import EmptyState from '../components/EmptyState';
import { LoadingBlock } from '../components/Spinner';
import { useDeviceStore } from '../stores/deviceStore';
import { useUiStore } from '../stores/uiStore';
import { useDebounce } from '../hooks/useDebounce';
import { useI18n } from '../i18n/useI18n';

/** Device inventory: search, claim, open. */
export function DevicesPage() {
  const { t } = useI18n();
  const { devices, loading, error, load, claim } = useDeviceStore();
  const toast = useUiStore((s) => s.toast);
  const [query, setQuery] = useState('');
  const [claimOpen, setClaimOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const debounced = useDebounce(query.trim().toLowerCase(), 200);

  useEffect(() => {
    load().catch(() => {
      /* error surfaced through the store */
    });
  }, [load]);

  const filtered = debounced
    ? devices.filter((device) =>
        [device.displayName, device.deviceId, device.locationName, device.model]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(debounced))
      )
    : devices;

  async function handleClaim(deviceId, claimCode) {
    setClaiming(true);
    try {
      const device = await claim(deviceId, claimCode);
      toast(t('devices.claimSuccess', { name: device.displayName || device.deviceId }), 'ok');
    } finally {
      setClaiming(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{t('devices.title')}</h1>
          <p className="muted">
            {devices.length === 1 ? t('devices.ownedOne') : t('devices.ownedMany', { count: devices.length })}
          </p>
        </div>

        <div className="page-header__actions">
          <input
            className="input"
            type="search"
            placeholder={t('devices.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={t('devices.searchAria')}
          />
          <button type="button" className="button button--primary" onClick={() => setClaimOpen(true)}>
            {t('devices.claim')}
          </button>
        </div>
      </header>

      {error && <p className="form__error">{error}</p>}
      {loading && devices.length === 0 ? (
        <LoadingBlock label={t('devices.loading')} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="📡"
          title={devices.length === 0 ? t('devices.emptyNoneTitle') : t('devices.emptySearchTitle')}
          hint={devices.length === 0 ? t('devices.emptyNoneHint') : t('devices.emptySearchHint')}
          action={
            devices.length === 0 ? (
              <button type="button" className="button button--primary" onClick={() => setClaimOpen(true)}>
                {t('devices.claim')}
              </button>
            ) : null
          }
        />
      ) : (
        <div className="device-grid">
          {filtered.map((device) => (
            <DeviceCard key={device.deviceId} device={device} />
          ))}
        </div>
      )}

      <ClaimDeviceModal open={claimOpen} onClose={() => setClaimOpen(false)} onClaim={handleClaim} loading={claiming} />
    </>
  );
}

export default DevicesPage;
