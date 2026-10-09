import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const ALL_ROLES = ['admin', 'manager', 'owner', 'viewer'];

const TABS = [
  { to: '/', label: 'Home', icon: '📊', end: true, roles: ALL_ROLES },
  { to: '/devices', label: 'Devices', icon: '📡', roles: ALL_ROLES },
  { to: '/guide', label: 'Guide', icon: '📖', roles: ALL_ROLES },
  { to: '/settings', label: 'Settings', icon: '⚙️', roles: ALL_ROLES },
];

/** Thumb-friendly nav fixed to the bottom on narrow viewports. */
export function MobileBottomNav() {
  const { user } = useAuth();
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
          <span className="bottom-nav__icon" aria-hidden="true">
            {item.icon}
          </span>
          <span className="bottom-nav__label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default MobileBottomNav;
