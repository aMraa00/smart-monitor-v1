import { describeCapabilityI18n, isQualityOk, qualityLabel } from '../utils/capabilities';
import { formatValue, formatRelative } from '../utils/formatters';
import { useI18n } from '../i18n/useI18n';
import Sparkline from './Sparkline';

/**
 * One measurement tile.
 *
 * The tile knows nothing about hardware: it receives a capability NAME and a
 * reading, and looks up its own label/unit/colour. That is what lets an
 * `agriculture` or `industrial` device render without a frontend change (§10.2).
 */
export function StatTile({ capability, reading, trend = [], time, size = 'default' }) {
  const { t } = useI18n();
  const meta = describeCapabilityI18n(capability, t);
  const raw = reading ? reading.value : null;
  const quality = reading ? reading.quality : null;
  const healthy = isQualityOk(quality);

  // Absolute pressure is unreadable in Pa - show hPa but keep the unit honest.
  const displayValue =
    raw === null || raw === undefined
      ? '—'
      : capability === 'pressure'
        ? formatValue(Number(raw) / 100, { decimals: 1 })
        : formatValue(raw, { decimals: meta.decimals });
  const displayUnit = capability === 'pressure' ? 'hPa' : meta.unit;

  return (
    <article
      className={`tile ${size === 'hero' ? 'tile--hero' : ''} ${healthy ? '' : 'tile--warn'}`.trim()}
      style={{ '--tile-color': meta.color }}
    >
      <header className="tile__head">
        <span className="tile__icon-badge" aria-hidden="true">
          {meta.icon}
        </span>
        <div className="tile__meta">
          <span className="tile__label" title={meta.label}>
            {meta.label}
          </span>
          {!healthy && (
            <span className={`tile__quality tile__quality--${quality || 'unknown'}`.trim()} title={qualityLabel(quality, t)}>
              {qualityLabel(quality, t)}
            </span>
          )}
        </div>
      </header>

      <div className="tile__value">
        {displayValue}
        <span className="tile__unit">{displayUnit}</span>
      </div>

      <footer className="tile__foot">
        <Sparkline values={trend} color={meta.color} />
        <span className="tile__time">{formatRelative(time)}</span>
      </footer>
    </article>
  );
}

export default StatTile;
