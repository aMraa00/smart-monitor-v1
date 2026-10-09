import { useState } from 'react';
import { useI18n } from '../../i18n/useI18n';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthForm({ mode, onSubmit, loading }) {
  const { t } = useI18n();
  const isRegister = mode === 'register';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!EMAIL_RE.test(email.trim())) return setError(t('auth.invalidEmail'));
    if (password.length < 8) return setError(t('auth.passwordShort'));

    try {
      await onSubmit(isRegister ? { email: email.trim(), password, name: name.trim() } : { email: email.trim(), password });
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}

      {isRegister && (
        <label className="field">
          <span>{t('auth.name')}</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('auth.optional')}
            autoComplete="name"
            maxLength={80}
          />
        </label>
      )}

      <label className="field">
        <span>{t('auth.email')}</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
      </label>

      <label className="field">
        <span>{t('auth.password')}</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          required
        />
      </label>

      <button type="submit" className="button button--primary button--block" disabled={loading}>
        {loading ? t('auth.pleaseWait') : isRegister ? t('auth.signUp') : t('auth.signIn')}
      </button>
    </form>
  );
}

export default AuthForm;
