import { Capacitor } from '@capacitor/core';
import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';
import { useKeyboardOpen } from '../lib/keyboard';

export default function AppShell() {
  const native = Capacitor.isNativePlatform();
  const location = useLocation();
  const keyboardOpen = useKeyboardOpen();
  const hideNav = keyboardOpen || location.pathname === '/search';

  return (
    <div
      className={
        native
          ? 'flex h-full min-h-0 w-full justify-center bg-surface'
          : 'flex h-[100dvh] justify-center bg-surface-container-low md:py-6'
      }
    >
      <div
        className={
          native
            ? 'app-safe-top relative flex h-full w-full flex-col overflow-hidden bg-surface'
            : 'app-safe-top relative flex h-full w-full max-w-app flex-col overflow-hidden bg-surface md:rounded-xl md:pt-0 md:shadow-frame'
        }
      >
        {native ? (
          <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto">
            <div className={`flex min-h-full flex-col ${hideNav ? 'pb-4' : 'pb-24'}`}>
              <Outlet />
            </div>
          </div>
        ) : (
          <div className={`hide-scrollbar flex-1 overflow-y-auto ${hideNav ? 'pb-4' : 'pb-24'}`}>
            <Outlet />
          </div>
        )}

        {!hideNav && <BottomNav />}
      </div>
    </div>
  );
}
