import { Link } from 'react-router-dom';
import Badge from '../../components/Badge';
import { describeCapabilityI18n } from '../../utils/capabilities';
import { STATUS_TONE, formatRelative, isOnline } from '../../utils/formatters';
import { useI18n } from '../../i18n/useI18n';

/**
 * One row/card in the device list.
 *
 * Capabilities render as chips straight from `device.capabilities`, so a new
 * product model lists its own measurements without touching this file.
 */
export function DeviceCard({ device }) {
  const { t } = useI18n();
  const online = isOnline(device.lastSeenAt);
  const name = device.displayName || device.deviceId;
  const capabilities = (device.capabilities || []).slice(0, 6);
  const hidden = (device.capabilities || []).length - capabilities.length;

  return (
    <Link to={`/devices/${device.deviceId}`} className="device-card">
      <div className="device-card__thumb" aria-hidden="true" />
      <header className="device-card__head">
        <div>
          <h3 className="device-card__name">{name}</h3>
          <code className="device-card__id">{device.deviceId}</code>
        </div>
        <div className="device-card__badges">
          <Badge tone={online ? 'ok' : 'danger'}>{online ? t('common.online') : t('common.offline')}</Badge>
          <Badge tone={STATUS_TONE[device.status] || 'neutral'}>{device.status}</Badge>
        </div>
      </header>

      <p className="device-card__meta">
        {device.locationName || 'No location'} · last seen {formatRelative(device.lastSeenAt)}
      </p>

      <ul className="device-card__caps">
        {capabilities.map((capability) => {
          const meta = describeCapabilityI18n(capability, t);
          return (
            <li key={capability} style={{ '--chip-color': meta.color }}>
              <span aria-hidden="true">{meta.icon}</span>
              {meta.label}
            </li>
          );
        })}
        {hidden > 0 && <li className="device-card__more">+{hidden}</li>}
        {capabilities.length === 0 && <li className="device-card__more">no capabilities declared</li>}
      </ul>

      <footer className="device-card__foot">
        <span>{device.model}</span>
        <span>fw {device.firmwareVersion}</span>
        <span>rssi {device.meta?.rssi ?? '—'}</span>
      </footer>
    </Link>
  );
}

export default DeviceCard;
