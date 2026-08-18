import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.cityidle',
  appName: '도시 키우기',
  webDir: 'dist',
  android: {
    backgroundColor: '#0b111c',
  },
  ios: {
    backgroundColor: '#0b111c',
    contentInset: 'never',
  },
  plugins: {
    SplashScreen: { launchShowDuration: 800, backgroundColor: '#0b111c' },
  },
};

export default config;
