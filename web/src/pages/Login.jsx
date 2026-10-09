import { Link, useNavigate } from 'react-router-dom';
import AuthForm from '../features/auth/AuthForm';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../i18n/useI18n';
import { IconLogo } from '../components/AppIcons';

export function LoginPage() {
  const { t } = useI18n();
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit({ email, password }) {
    await login(email, password);
    navigate('/', { replace: true });
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__brand">
          <IconLogo width={40} height={40} />
          <h1>{t('app.name')}</h1>
          <p>{t('app.tagline')}</p>
        </div>

        <h2 className="auth-card__title">{t('auth.signIn')}</h2>
        <AuthForm mode="login" onSubmit={handleSubmit} loading={loading} />

        <p className="auth-card__switch">
          {t('auth.noAccount')} <Link to="/register">{t('auth.createOne')}</Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
