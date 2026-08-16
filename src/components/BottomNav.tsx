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
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <nav className="nav-grain pointer-events-auto flex items-center justify-around rounded-[28px] px-2 py-2 shadow-soft ring-1 ring-primary/20">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              [
                'relative z-10 group flex min-w-[64px] flex-col items-center justify-center px-3 py-1 transition-colors',
                isActive ? 'text-primary' : 'text-on-surface/50',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <Icon name={tab.icon} fill={isActive} size={22} className="transition-transform group-active:scale-90" />
                <span className="mt-0.5 text-[10px] font-semibold tracking-wide">{tab.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
