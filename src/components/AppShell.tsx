import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import Icon from './Icon';

/**
 * Mobile-first frame. On a phone this fills the viewport; on desktop it renders
 * as a centred phone-width column so the design target stays honest.
 */
export default function AppShell() {
  return (
    <div className="flex h-[100dvh] justify-center bg-surface-container-low md:py-6">
      <div className="relative flex h-full w-full max-w-app flex-col overflow-hidden bg-surface md:rounded-xl md:shadow-frame">
        {/* Non-dismissible: the seeded coverage data is illustrative, not researched. */}
        <div className="flex shrink-0 items-center justify-center gap-1.5 bg-warning-container px-3 py-1 text-warning">
          <Icon name="science" size={14} />
          <p className="text-label-sm font-label-sm">Demo data — coverage shown is illustrative, not verified</p>
        </div>

        <div className="hide-scrollbar flex-1 overflow-y-auto">
          <Outlet />
        </div>

        <BottomNav />
      </div>
    </div>
  );
}
