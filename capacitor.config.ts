import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.cityservice',
  appName: 'CityService',
  webDir: 'dist',
  android: {
    // Capacitor 7 serves the WebView at https://localhost, so Vite can keep
    // base: '/' — nested website routes still load /assets correctly.
    allowMixedContent: false,
  },
  plugins: {
    CapacitorHttp: {
      // Native HTTP so the WebView can call Render without CORS blocking fetch.
      enabled: true,
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: '#FBF7F0',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#FBF7F0',
      overlaysWebView: false,
    },
  },
};

export default config;
