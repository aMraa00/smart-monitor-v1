import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { useDeviceStore } from '../stores/deviceStore';
import { useUiStore } from '../stores/uiStore';
import { usePreferencesStore } from '../stores/preferencesStore';
import { useI18n } from '../i18n/useI18n';
import { useAlertNotifications } from '../hooks/useAlertNotifications';
import Toaster from '../components/Toaster';
import MobileBottomNav from '../components/MobileBottomNav';
import InstallPrompt from '../components/InstallPrompt';
import { IconLogo, IconMoon, IconSun, NavIcon } from '../components/AppIcons';
import { hasReportsAccess } from '../utils/reportsAccess';

const ALL_ROLES = ['admin', 'manager', 'owner', 'viewer'];

const NAV = [
  { to: '/', labelKey: 'nav.dashboard', icon: 'dashboard', roles: ALL_ROLES, end: true },
  { to: '/devices', labelKey: 'nav.devices', icon: 'devices', roles: ALL_ROLES },
  { to: '/reports', labelKey: 'nav.reports', icon: 'guide', reportsAccess: true },
  { to: '/guide', labelKey: 'nav.guide', icon: 'guide', roles: ALL_ROLES },
  { to: '/users', labelKey: 'nav.users', icon: 'settings', roles: ['admin'] },
  { to: '/settings', labelKey: 'nav.settings', icon: 'settings', roles: ALL_ROLES },
];

function canSeeNavItem(item, user) {
  if (!user) return false;
  if (item.reportsAccess) return hasReportsAccess(user);
  return item.roles?.includes(user.role);
}

const SOCKET_TONE = {
  online: 'ok',
  connecting: 'warn',
  offline: 'danger',
  neutral: 'neutral',
};

export function AppLayout() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const socketState = useSocket();
  const navigate = useNavigate();
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setSidebar = useUiStore((s) => s.setSidebar);
  const resetDevices = useDeviceStore((s) => s.reset);
  const theme = usePreferencesStore((s) => s.theme);
  const toggleTheme = usePreferencesStore((s) => s.toggleTheme);
  const alertsEnabled = usePreferencesStore((s) => s.alertsEnabled);

  useAlertNotifications(alertsEnabled);

  useEffect(() => {
    if (!user) return undefined;
    refreshUser();
    const sync = () => refreshUser();
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') sync();
    });
    return () => window.removeEventListener('focus', sync);
  }, [user?.id, refreshUser]);

  const visibleNav = NAV.filter((item) => canSeeNavItem(item, user));

  async function handleLogout() {
    await logout();
    resetDevices();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="icon-button topbar__menu" onClick={() => setSidebar(!sidebarOpen)} aria-label="Menu">
          ☰
        </button>

        <NavLink to="/" className="brand">
          <IconLogo />
          {t('app.name')}
        </NavLink>

        <div className="topbar__right">
          <button type="button" className="icon-button icon-badge topbar__theme" onClick={toggleTheme} aria-label={t('settings.theme')}>
            {theme === 'dark' ? <IconSun width={18} height={18} /> : <IconMoon width={18} height={18} />}
          </button>
          <span className={`badge badge--${SOCKET_TONE[socketState] || 'neutral'} topbar__live`} title="Realtime">
            {socketState === 'online' ? t('common.live') : socketState}
          </span>
          <span className="topbar__user" title={user?.email}>
            {user?.name || user?.email || 'Account'}
          </span>
          {user?.role && <span className="badge badge--info topbar__role">{user.role}</span>}
          <button type="button" className="button button--ghost topbar__logout" onClick={handleLogout}>
            {t('common.signOut')}
          </button>
        </div>
      </header>

      <div className={`app__body ${sidebarOpen ? 'app__body--open' : ''}`.trim()}>
        <nav className="sidebar" aria-label="Main">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`.trim()}
              onClick={() => setSidebar(false)}
            >
              <NavIcon name={item.icon} width={20} height={20} />
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>

        <main className="content">
          <Outlet />
        </main>
      </div>

      <MobileBottomNav />
      <InstallPrompt />
      <Toaster />
    </div>
  );
}

export default AppLayout;
