# ecbills Scanner Bridge

Desktop companion app that pairs **ecbills.in** web billing with any USB
barcode/QR scanner. It runs in the system tray and exposes a small WebSocket +
HTTP server on `127.0.0.1:9080` (loopback only) so the browser billing page can
consume scans in real time.

## What it does

- Captures USB (keyboard-wedge) scanner keypresses while its window is focused
  and listening, then pushes `{ type: "scan", code }` over a local WebSocket.
- Provides a **portal** (barcode position indicator) for quick product addition,
  barcode/QR label generation, and label printing — operated from the tray icon.
- Pairs with the web billing screen (`ws://127.0.0.1:9080`). When paired, the
  billing page shows a green "Scanner Bridge: Online" pill and every scan
  auto-adds the matching product to the current bill.

## Downloads

- Windows: `ecbills-scanner-bridge-setup.exe` (NSIS installer)
- Linux: `ecbills-scanner-bridge.AppImage` (portable, `chmod +x` and run)

Grab them from the landing page → **Download** section or the GitHub Releases
page. The browser download/error indicator next to the billing search bar links
here automatically when the bridge is not detected.

## Setup

1. Install / run the bridge. A tray icon appears.
2. Open the portal from the tray, set your **Web App URL** (e.g.
   `http://localhost:9002`) and **Company ID** on the Connection tab.
3. Turn on **Scanner Listening**, then keep the portal window focused (or use it
   directly) while scanning.
4. In the browser: open the billing page. The status pill turns green when
   paired. Scan anything — it lands on the bill.
5. Use the **Barcode** tab to generate / print labels, or the **Add Product**
   tab for quick product creation.

## Develop

```bash
npm install
npm run start      # run the app (Electron)
npm run icon       # regenerate assets/icon.png
npm run dist:win   # build Windows NSIS installer (run on Windows / wine)
npm run dist:linux # build Linux AppImage
```

Installers are published to GitHub Releases automatically on tags matching
`scanner-bridge-*` via `.github/workflows/bridge-release.yml`.

## Ports / protocol

| Endpoint                     | Purpose                                  |
| ---------------------------- | ---------------------------------------- |
| `ws://127.0.0.1:9080`        | scan frames pushed to web clients        |
| `http://127.0.0.1:9080/health` | health check used by the status pill   |

Config is stored in `config.json` under Electron's `userData` directory.