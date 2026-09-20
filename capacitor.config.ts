import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lifequest.app',
  appName: 'LifeQuest',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
  ios: {
    path: 'ios-native',
    scheme: 'App',
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    CapacitorUpdater: {
      autoUpdate: false,
      statsUrl: '',
      channelUrl: '',
    },
    LocalNotifications: {
      iconColor: '#2563eb',
      sound: 'lifequest_reminder.wav',
      presentationOptions: ['badge', 'sound', 'banner', 'list'],
    },
  },
};

export default config;
