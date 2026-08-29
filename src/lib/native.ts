import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

const CREAM = '#FBF7F0';

/** Status bar, splash, and Android hardware back. No-ops in the browser. */
export async function initNativeShell(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  document.documentElement.classList.add('is-native-app');

  try {
    // WebView already sits below the status bar; do not add CSS inset on top.
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: CREAM });
  } catch {
    // Plugin unavailable (web preview, or a device without StatusBar).
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
