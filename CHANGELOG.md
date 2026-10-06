# Changelog

All notable changes to the **ecbills** project are documented here — one file
for both the **app** (web/desktop billing application) and the **Scanner
Bridge** (Windows/Linux desktop companion).

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Newest releases first. Headings are `## [app <semver>] - <date>` and
`## [bridge <semver>] - <date>`.

Release wiring:

- Bridge GitHub tags/releases use `scanner-bridge-v<semver>`.
- `.github/workflows/bridge-release.yml` builds the Windows/Linux installers
  and publishes them to the matching release; the release notes are taken from
  the `## [bridge <semver>]` section below (falls back to auto-generated notes).
- The web app reads the bridge version from `SCANNER_BRIDGE_VERSION` in
  `src/lib/scanner-bridge-downloads.ts` — keep it equal to the version in
  `scanner-bridge/package.json`, `scanner-bridge/main.js` (`APP_BRIDGE_VERSION`)
  and `scanner-bridge/preload.js`.

## [Unreleased]

### App

- Returns now show the amount owed to the customer.
- Sidebar sub-items no longer clip their padding; sub-nav rebuilt.
- Products can be created with Shift+Enter without fuzzy matches blocking.
- Return/exchange bills link back to the original sale with netted accounting.
- First purchase of a quick-created product adds its stock layer; range
  operators respected when counting filtered products.
- WhatsApp Business integration (link device, bill messaging, campaigns) is
  behind a coming-soon gate; sessions kept in memory.
- CI: `.vercelignore` keeps heavy local dirs out of production uploads.

## [bridge 1.1.0] - 2026-10-06

### Added

- Devices dashboard in the portal with live printer and scanner cards
  (label/receipt printer classification and assignment).

### Fixed

- Portal window is shown on Linux (previously the window could stay hidden).
- `/health` now reports the same `captureMode` values as the WebSocket
  `hello`/`status` frames (`window` when listening, `idle` when paused) —
  it used to report `none`, which the web app did not understand.
- Web app and bridge agree on the capture-mode protocol: `'window' | 'idle' | 'none'`.
  The dead `'global'` mode was removed from the status pill and download page.
- Version strings unified at `1.1.0` (download page, landing cards, portal
  footer fallback, release workflow default tag, lockfile).

### Changed

- Platform copy is OS-neutral (printer settings hint no longer Windows-only,
  macOS/Android cards say "Coming soon" instead of a fabricated version).

## [bridge 1.0.0] - 2026-09-15

### Added

- First release of the ecbills Scanner Bridge: tray app for Windows and Linux
  that captures USB keyboard-wedge scanner input and pushes scans to the
  billing page over `ws://127.0.0.1:9080`.
- Local portal for quick product add, barcode/QR label generation and silent
  label printing, plus printer/scanner device inventory.
- Loopback HTTP health endpoint on `http://127.0.0.1:9080/health`.
- CI pipeline building and publishing the NSIS installer and AppImage.

## [app 4.0.0] - 2026-09-19

### Added

- Billing sub-sections with a secondary sidebar, descriptions and distinct
  local design; rotating universal loading indicator.
- Bridge download page (`/download`), landing download section and a pairing
  status pill next to the billing search bar.

### Changed

- Brand logos unified; royal green sidebar/theme with theme-aware secondary
  sidebar, bolder nav text and themed scrollbar.
- Plan pricing updated with yearly cycle and early-bird discount.

## [app 3.2.7] - 2026-08-26

### Fixed

- Bill reflection, stock display and bill history.
- Estimate mode row totals and discount accumulation; tabbed bill-history
  type filter with counts.
- POS thermal printing.

### Removed

- Dead code: orphaned AI dir, duplicate bill-history-table, deprecated
  redirects, unused UI components, stale type definitions.

---

For older releases see the git history (`git log --oneline`).
