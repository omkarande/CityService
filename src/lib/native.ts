import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

const CREAM = '#FBF7F0';

/** Status bar, splash, and Android hardware back — no-ops in the browser. */
export async function initNativeShell(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  document.documentElement.classList.add('is-native-app');

  const isAndroid = Capacitor.getPlatform() === 'android';
  if (isAndroid) {
    document.documentElement.style.setProperty('--app-status-bar', '48px');
  }

  try {
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: CREAM });
    // Android 15 draws edge-to-edge even when overlay is false, so pad the
    // webview below the camera / status bar (Wi‑Fi, airplane mode, clock).
    if (isAndroid) {
      const info = await StatusBar.getInfo();
      const px = Math.max(Math.ceil(info.height || 0), 48);
      document.documentElement.style.setProperty('--app-status-bar', `${px}px`);
    }
  } catch {
    if (isAndroid) {
      document.documentElement.style.setProperty('--app-status-bar', '48px');
    }
  }

  CapApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
      return;
    }
    CapApp.exitApp();
  });

  await SplashScreen.hide();
}
