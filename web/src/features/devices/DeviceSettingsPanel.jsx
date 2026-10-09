import { useEffect, useState } from 'react';
import Card from '../../components/Card';
import { useI18n } from '../../i18n/useI18n';

export function DeviceSettingsPanel({ device, onSave, saving }) {
  const { t } = useI18n();
  const [displayName, setDisplayName] = useState(device.displayName || '');
  const [locationName, setLocationName] = useState(device.locationName || '');
  const [sampleIntervalS, setSampleIntervalS] = useState(device.config?.sampleIntervalS ?? 60);
  const [windCoef, setWindCoef] = useState(device.config?.calibration?.windCalibrationCoef ?? 1);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    setDisplayName(device.displayName || '');
    setLocationName(device.locationName || '');
    setSampleIntervalS(device.config?.sampleIntervalS ?? 60);
    setWindCoef(device.config?.calibration?.windCalibrationCoef ?? 1);
  }, [device]);

  async function submit(event) {
    event.preventDefault();
    setMessage(null);
    try {
      await onSave({
        displayName: displayName.trim(),
        locationName: locationName.trim(),
        config: {
          sampleIntervalS: Number(sampleIntervalS),
          calibration: { windCalibrationCoef: Number(windCoef) },
        },
      });
      setMessage({ tone: 'ok', text: t('deviceDetail.saved') });
    } catch (err) {
      setMessage({ tone: 'danger', text: err.message || t('deviceDetail.saveFailed') });
    }
  }

  return (
    <Card title={t('deviceDetail.settingsTitle')} subtitle={t('deviceDetail.settingsSubtitle')}>
      <form className="form" onSubmit={submit}>
        <div className="form__grid">
          <label className="field">
            <span>{t('deviceDetail.displayName')}</span>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={120} placeholder="Roof station" />
          </label>

          <label className="field">
            <span>{t('deviceDetail.location')}</span>
            <input value={locationName} onChange={(e) => setLocationName(e.target.value)} maxLength={160} placeholder="Ulaanbaatar, roof" />
          </label>

          <label className="field">
            <span>{t('deviceDetail.sampleInterval')}</span>
            <input
              type="number"
              min={5}
              max={3600}
              value={sampleIntervalS}
              onChange={(e) => setSampleIntervalS(e.target.value)}
            />
          </label>

          <label className="field">
            <span>{t('deviceDetail.windCoef')}</span>
            <input type="number" step="0.01" min="0.01" max="20" value={windCoef} onChange={(e) => setWindCoef(e.target.value)} />
            <small className="field__hint">
              {Number(windCoef) === 1 ? t('deviceDetail.windUncalibrated') : t('deviceDetail.windCalibrated')}
            </small>
          </label>
        </div>

        {message && (
          <p className={`form__${message.tone === 'ok' ? 'success' : 'error'}`} role="status">
            {message.text}
          </p>
        )}

        <button type="submit" className="button button--primary" disabled={saving}>
          {saving ? t('deviceDetail.saving') : t('deviceDetail.saveChanges')}
        </button>
      </form>
    </Card>
  );
}

export default DeviceSettingsPanel;
