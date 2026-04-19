export type LicensePlatform = 'web' | 'desktop' | 'android' | 'ios';

const STORAGE_KEY = 'hani_device_id';

const randomId = () =>
  'dev-' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);

export const getDevicePlatform = (): LicensePlatform => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'web';
  }

  const userAgent = navigator.userAgent.toLowerCase();
  const isCapacitor = Boolean((window as any)?.Capacitor);
  const isElectron = userAgent.includes('electron');
  const isAndroid = userAgent.includes('android');
  const isIos = /iphone|ipad|ipod/.test(userAgent);

  if (isElectron) return 'desktop';
  if (isCapacitor && isAndroid) return 'android';
  if (isCapacitor && isIos) return 'ios';
  return 'web';
};

export const getDeviceName = (): string => {
  if (typeof navigator === 'undefined') {
    return 'Unknown device';
  }

  const platform = getDevicePlatform();
  const userAgent = navigator.userAgent;

  if (platform === 'desktop') return 'Desktop app';
  if (platform === 'android') return 'Android device';
  if (platform === 'ios') return 'iPhone / iPad';
  return userAgent.slice(0, 120);
};

export const getHWID = async (): Promise<string> => {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) {
      return existing;
    }

    const generated = randomId();
    localStorage.setItem(STORAGE_KEY, generated);
    return generated;
  } catch {
    return `fallback-${Date.now()}`;
  }
};

export const getDeviceIdentity = async () => ({
  deviceId: await getHWID(),
  platform: getDevicePlatform(),
  deviceName: getDeviceName(),
});
