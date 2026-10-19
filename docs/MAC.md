# Mapaseo PDF for Apple Silicon Macs

Target: native macOS arm64, including the M2 Pro. The Windows installers do not run on macOS.

## Build without your Mac

The manual GitHub Actions workflow `.github/workflows/macos-arm64.yml` uses an Apple Silicon macOS 15 runner. It installs locked dependencies, runs unit tests, builds a DMG and ZIP, verifies the arm64 executable and code signature, and launches the packaged app for native PDF and desktop checks. Artifacts are uploaded only after every check passes and retained for 14 days. Nothing is published as a public release.

Once this source is in a GitHub repository, open **Actions → Build Mac app (Apple Silicon) → Run workflow**. Download **Mapaseo-PDF-Mac-Apple-Silicon** from the successful run. The repository must allow GitHub Actions. Private repository runs use the account's Actions allowance and can incur charges when that allowance is exhausted; check the account's billing limits before dispatching.

This workflow has been prepared on Windows. A local Windows test pass does not establish that the Mac package builds or runs; the macOS job must finish successfully before a Mac installer can be considered verified.

## Install the personal test build

Open the DMG and drag **Mapaseo PDF.app** into **Applications**. The ZIP contains the same application as an alternative. Check the SHA-256 checksums against `SHA256SUMS-mac.txt`.

The current build uses an **ad-hoc signature**, with no Developer ID certificate and no Apple notarization. macOS may block a downloaded build. For a personal build you trust, follow Apple's documented per-app **Privacy & Security → Open Anyway** process if offered. Do not disable Gatekeeper globally. Public distribution should use Developer ID signing and notarization; this configuration is not a Mac App Store submission.

## Build locally later

On an Apple Silicon Mac, install Node.js 22.13 or newer, open Terminal in the source folder, and run:

```sh
npm ci
npm test
npm run package:mac
npm run test:mac
```

Output: `release/Mapaseo-PDF-1.1.0-mac-arm64.dmg` and `.zip`.

## Mac behavior

- Native close, minimize and full-screen controls in the compact titlebar.
- Application, File, Edit, View and Window menus; Command shortcuts.
- Closing the last window leaves the app in the Dock; clicking the Dock icon opens it again.
- PDFs opened from Finder are queued until the renderer is ready.
- Ctrl+mouse wheel and Command+mouse wheel zoom the document. Trackpad pinch also commonly generates Ctrl+wheel events.
- Left and right panel preferences remain saved on the device.
- PDF.js rendering, vector-preserving exports and local AI use the same application code. Native printing, Finder association and physical trackpad behavior still merit a check on your own Mac.

## References

- [GitHub-hosted macOS runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
- [Apple: open an app from an unidentified developer](https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unknown-developer-mh40616/mac)
- [Apple: notarizing macOS software](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)
