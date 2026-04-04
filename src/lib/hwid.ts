import { machineId } from 'node-machine-id';

export const getHWID = async (): Promise<string> => {
  try {
    // In a browser environment, we might use a combination of browser fingerprints
    // but since this is a desktop-oriented POS, node-machine-id is preferred if running in Electron.
    // For this web demo, we'll use a persistent browser-based fingerprint.
    let hwid = localStorage.getItem('hani_hwid');
    if (!hwid) {
      hwid = 'HWID-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('hani_hwid', hwid);
    }
    return hwid;
  } catch (error) {
    return 'BROWSER-FALLBACK-' + navigator.userAgent.length;
  }
};
