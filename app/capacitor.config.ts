import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.muzlo.app',
  appName: 'Чьё музло?!',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
};

export default config;
