import Card from '../components/Card';
import Badge from '../components/Badge';
import { useAuth } from '../hooks/useAuth';
import { useDeviceStore } from '../stores/deviceStore';
import { usePreferencesStore } from '../stores/preferencesStore';
import { useI18n } from '../i18n/useI18n';
import { requestAlertPermission } from '../hooks/useAlertNotifications';
import { IconBell } from '../components/AppIcons';

const ROLE_TONE = { admin: 'info', manager: 'warn', owner: 'neutral', viewer: 'neutral' };

export function SettingsPage() {
  const { t, locale, setLocale } = useI18n();
  const { user, logout } = useAuth();
  const resetDevices = useDeviceStore((s) => s.reset);
  const theme = usePreferencesStore((s) => s.theme);
  const setTheme = usePreferencesStore((s) => s.setTheme);
  const alertsEnabled = usePreferencesStore((s) => s.alertsEnabled);
  const setAlertsEnabled = usePreferencesStore((s) => s.setAlertsEnabled);

  async function toggleAlerts(next) {
    if (next) {
      const perm = await requestAlertPermission();
      if (perm !== 'granted') {
        setAlertsEnabled(false);
        return;
      }
    }
    setAlertsEnabled(next);
  }

  return (
    <>
      <header className="page-header">
        <div>
          <h1>{t('settings.title')}</h1>
          <p className="muted">{t('settings.subtitle')}</p>
        </div>
      </header>

      <Card title={t('settings.appearance')}>
        <div className="settings-row">
          <span>{t('settings.theme')}</span>
          <div className="segmented">
            <button
              type="button"
              className={`segmented__item ${theme === 'dark' ? 'segmented__item--active' : ''}`.trim()}
              onClick={() => setTheme('dark')}
            >
              {t('settings.themeDark')}
            </button>
            <button
              type="button"
              className={`segmented__item ${theme === 'light' ? 'segmented__item--active' : ''}`.trim()}
              onClick={() => setTheme('light')}
            >
              {t('settings.themeLight')}
            </button>
          </div>
        </div>
        <div className="settings-row">
          <span>{t('settings.language')}</span>
          <div className="segmented">
            <button
              type="button"
              className={`segmented__item ${locale === 'mn' ? 'segmented__item--active' : ''}`.trim()}
              onClick={() => setLocale('mn')}
            >
              {t('settings.langMn')}
            </button>
            <button
              type="button"
              className={`segmented__item ${locale === 'en' ? 'segmented__item--active' : ''}`.trim()}
              onClick={() => setLocale('en')}
            >
              {t('settings.langEn')}
            </button>
          </div>
        </div>
      </Card>

      <Card title={t('settings.notifications')} subtitle={t('settings.alertsHint')}>
        <label className="settings-toggle">
          <span className="settings-toggle__label">
            <span className="icon-badge" aria-hidden="true">
              <IconBell width={18} height={18} />
            </span>
            {t('settings.alertsEnable')}
          </span>
          <input
            type="checkbox"
            checked={alertsEnabled}
            onChange={(e) => toggleAlerts(e.target.checked)}
          />
        </label>
        {typeof Notification !== 'undefined' && Notification.permission === 'denied' && (
          <p className="form__error">{t('settings.alertsDenied')}</p>
        )}
        {alertsEnabled && Notification?.permission === 'granted' && (
          <p className="form__success">{t('settings.alertsGranted')}</p>
        )}
      </Card>

      <Card title={t('settings.profile')}>
        <dl className="detail-list">
          <div>
            <dt>{t('auth.name')}</dt>
            <dd>{user?.name || '—'}</dd>
          </div>
          <div>
            <dt>{t('auth.email')}</dt>
            <dd>{user?.email || '—'}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>
              <Badge tone={ROLE_TONE[user?.role] || 'neutral'}>{user?.role || 'owner'}</Badge>
            </dd>
          </div>
        </dl>
      </Card>

      <Card title={t('settings.session')} subtitle={t('settings.sessionHint')}>
        <button
          type="button"
          className="button button--danger"
          onClick={async () => {
            await logout();
            resetDevices();
            window.location.assign('/login');
          }}
        >
          {t('common.signOutEverywhere')}
        </button>
      </Card>
    </>
  );
}

export default SettingsPage;
