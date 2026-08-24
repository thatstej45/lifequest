import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lifequest.app',
  appName: 'LifeQuest',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
  ios: {
    contentInset: 'automatic',
    scheme: 'LifeQuest',
  },
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },
  plugins: {
    CapacitorUpdater: {
      autoUpdate: false,
      statsUrl: '',
      channelUrl: '',
    },
    LocalNotifications: {
      iconColor: '#2563eb',
    },
  },
};

export default config;
