import { Link, useNavigate } from 'react-router-dom';
import AuthForm from '../features/auth/AuthForm';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../i18n/useI18n';
import { IconLogo } from '../components/AppIcons';

export function RegisterPage() {
  const { t } = useI18n();
  const { register, loading } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(payload) {
    await register(payload);
    navigate('/', { replace: true });
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__brand">
          <IconLogo width={40} height={40} />
          <h1>{t('app.name')}</h1>
          <p>{t('auth.registerTagline')}</p>
        </div>

        <h2 className="auth-card__title">{t('auth.signUp')}</h2>
        <AuthForm mode="register" onSubmit={handleSubmit} loading={loading} />

        <p className="auth-card__switch">
          {t('auth.hasAccount')} <Link to="/login">{t('auth.signIn')}</Link>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;
