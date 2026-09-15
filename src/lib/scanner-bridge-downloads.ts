/**
 * Desktop scanner bridge download metadata.
 *
 * The bridge is a small Windows/Linux desktop app that listens on
 * 127.0.0.1:9080 (WebSocket + HTTP). A USB barcode/QR scanner's keypresses
 * are captured by the bridge and pushed to the browser billing page, which
 * auto-adds the scanned product to the bill.
 *
 * Installers are published to GitHub Releases on every release; the
 * `latest/download/<name>` URLs below always resolve to the newest build.
 */
export const SCANNER_BRIDGE_VERSION = '1.0.0';
export const SCANNER_BRIDGE_WS_URL = 'ws://127.0.0.1:9080';
export const SCANNER_BRIDGE_HEALTH_URL_LOCAL = 'http://127.0.0.1:9080/health';
export const SCANNER_BRIDGE_DOWNLOAD_PAGE = '/download';

export interface BridgeDownload {
  platform: 'windows' | 'linux';
  label: string;
  fileName: string;
  url: string;
  description: string;
  requirements: string;
}

export const BRIDGE_DOWNLOADS: BridgeDownload[] = [
  {
    platform: 'windows',
    label: 'Windows',
    fileName: 'ecbills-scanner-bridge-setup.exe',
    url: 'https://github.com/Living-Tuna/stockflow/releases/latest/download/ecbills-scanner-bridge-setup.exe',
    description: 'Windows installer for the ecbills desktop scanner bridge. Runs in the taskbar so USB barcode/QR scanners auto-fill your billing screen.',
    requirements: 'Windows 10/11 x64',
  },
  {
    platform: 'linux',
    label: 'Linux',
    fileName: 'ecbills-scanner-bridge.AppImage',
    url: 'https://github.com/Living-Tuna/stockflow/releases/latest/download/ecbills-scanner-bridge.AppImage',
    description: 'Portable Linux AppImage for the ecbills desktop scanner bridge. Runs from the system tray with a small portal window for products and labels.',
    requirements: 'Linux x64 (chmod +x and run)',
  },
];

/** How the bridge pairs with the browser (shown on the download page). */
export const BRIDGE_PAIRING_STEPS = [
  {
    title: 'Download & install',
    description: `Get the ${BRIDGE_DOWNLOADS[0].label} or ${BRIDGE_DOWNLOADS[1].label} edition and run the installer (Windows) or AppImage (Linux).`,
  },
  {
    title: 'Start the bridge',
    description: 'The bridge adds a taskbar/system-tray icon. Open the portal from the tray and turn on "Scanner Listening".',
  },
  {
    title: 'Pair with your browser',
    description: 'It listens on a localhost port (ws://127.0.0.1:9080). Open this billing page — a green status pill appears when paired.',
  },
  {
    title: 'Scan & bill',
    description: 'Scan any product barcode/QR with your USB scanner. The matching product is auto-added to the bill for fast checkout.',
  },
];