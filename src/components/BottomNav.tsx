import { NavLink } from 'react-router-dom';
import Icon from './Icon';

const TABS = [
  { to: '/', icon: 'explore', label: 'Explore', end: true },
  { to: '/nearby', icon: 'map', label: 'Nearby', end: false },
  { to: '/saved', icon: 'bookmark', label: 'Saved', end: false },
  { to: '/account', icon: 'person', label: 'Account', end: false },
];

export default function BottomNav() {
  return (
    <nav className="pb-safe sticky bottom-0 z-40 flex items-center justify-around border-t border-outline-variant/20 bg-surface/90 px-2 pt-2 backdrop-blur-lg">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            [
              'group flex min-w-[64px] flex-col items-center justify-center rounded-full px-4 py-1 transition-all duration-200',
              isActive
                ? 'bg-secondary-container text-on-secondary-container'
                : 'text-on-surface-variant hover:text-primary',
            ].join(' ')
          }
        >
          {({ isActive }) => (
            <>
              <Icon name={tab.icon} fill={isActive} className="transition-transform group-active:scale-90" />
              <span className="mt-0.5 text-label-sm font-label-sm">{tab.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
