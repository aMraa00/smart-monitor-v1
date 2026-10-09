import { useState } from 'react';
import { useI18n } from '../../i18n/useI18n';

export function TransferForm({ onTransfer, loading }) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      await onTransfer(email.trim());
      setEmail('');
    } catch (err) {
      setError(err.message || t('deviceDetail.transferFailed'));
    }
  }

  return (
    <form className="form form--inline" onSubmit={submit}>
      <label className="field field--grow">
        <span>{t('deviceDetail.transferEmail')}</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@example.com" required />
      </label>
      <button type="submit" className="button button--ghost" disabled={loading}>
        {t('deviceDetail.transfer')}
      </button>
      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

export default TransferForm;
