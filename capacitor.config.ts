import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hanilink.mobile',
  appName: 'HaniLink',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
