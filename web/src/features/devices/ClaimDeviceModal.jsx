import { useState } from 'react';
import Modal from '../../components/Modal';
import { useI18n } from '../../i18n/useI18n';

/**
 * Claim an unowned device with the code shown on the device display.
 *
 * The server owns every rule here (expiry, attempt counter, already-claimed);
 * this dialog only collects the two values and surfaces the API error verbatim.
 */
export function ClaimDeviceModal({ open, onClose, onClaim, loading }) {
  const { t } = useI18n();
  const [deviceId, setDeviceId] = useState('');
  const [claimCode, setClaimCode] = useState('');
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      await onClaim(deviceId.trim().toUpperCase(), claimCode.trim().toUpperCase());
      setDeviceId('');
      setClaimCode('');
      onClose();
    } catch (err) {
      setError(err.message || t('devices.claimFailed'));
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('devices.claimModalTitle')}>
      <form className="form" onSubmit={submit}>
        <p className="form__hint">{t('devices.claimHint')}</p>

        {error && (
          <p className="form__error" role="alert">
            {error}
          </p>
        )}

        <label className="field">
          <span>{t('devices.deviceId')}</span>
          <input
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            placeholder="SMV1-A1B2C3D4E5F6"
            required
          />
        </label>

        <label className="field">
          <span>{t('devices.claimCode')}</span>
          <input value={claimCode} onChange={(e) => setClaimCode(e.target.value)} placeholder="ABC123" required />
        </label>

        <button type="submit" className="button button--primary button--block" disabled={loading}>
          {loading ? t('devices.claiming') : t('devices.claim')}
        </button>
      </form>
    </Modal>
  );
}

export default ClaimDeviceModal;
