import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../i18n/useI18n';
import { NavIcon } from './AppIcons';

const ALL_ROLES = ['admin', 'manager', 'owner', 'viewer'];

const TABS = [
  { to: '/', labelKey: 'nav.dashboard', icon: 'dashboard', end: true, roles: ALL_ROLES },
  { to: '/devices', labelKey: 'nav.devices', icon: 'devices', roles: ALL_ROLES },
  { to: '/guide', labelKey: 'nav.guide', icon: 'guide', roles: ALL_ROLES },
  { to: '/settings', labelKey: 'nav.settings', icon: 'settings', roles: ALL_ROLES },
];

export function MobileBottomNav() {
  const { user } = useAuth();
  const { t } = useI18n();
  const items = TABS.filter((item) => item.roles.includes(user?.role));

  return (
    <nav className="bottom-nav" aria-label="Mobile">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `bottom-nav__item ${isActive ? 'bottom-nav__item--active' : ''}`.trim()}
        >
          <span className="bottom-nav__icon-wrap">
            <NavIcon name={item.icon} width={20} height={20} />
          </span>
          <span className="bottom-nav__label">{t(item.labelKey)}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default MobileBottomNav;
