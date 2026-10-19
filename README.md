# Mapaseo PDF

A PDF workspace for Windows, with Apple Silicon macOS support prepared for native build verification. It has an original interface, precise document framing, a page navigator on the left, and contextual tools and document assistance on the right. Built with React, PDF.js, pdf-lib, and Electron.

For M2 Pro and other Apple Silicon Macs, see [the Mac build instructions](docs/MAC.md). The manual GitHub Actions workflow can build and check the Mac app without access to your laptop.

This is an independent application. It has no affiliation with Adobe and does not copy Acrobat's code, branding, or proprietary assets. It provides a working foundation for a professional PDF product; it is not a claim of Acrobat feature parity.

## Run on Windows

Use a Windows 10/11 x64 laptop and Node.js 22.13 or newer (Node.js 24 LTS is suitable).

```powershell
npm ci
npm run desktop
```

For development, run these commands in separate terminals:

```powershell
npm run dev
```

```powershell
npm run desktop:dev
```

The browser development preview is available at http://127.0.0.1:5173. The Electron app provides native open/save dialogs, Windows printing, recent files, window controls, file association handling, and optional local generative AI. Browser-only previews use browser file handling and do not expose the desktop bridge.

## Build a Windows app

```powershell
npm run test
npm run build
node scripts/third-party-notices.mjs
npm run package
```

The portable executable is written to `release`. To produce an installer:

```powershell
npm run package:installer
```

After building, `node tests/electron-smoke.cjs` exercises the real desktop bridge, sandbox settings, protocol rendering, dialog-selected saving, recent-file permissions, print-file cleanup, and window controls. It mocks dialog selections and the final printer callback so it can run without a physical printer or a local AI model.

Run `node tests/desktop-layout.cjs` after building to verify the compact reader, Ctrl + mouse wheel zoom, and panel preferences in real Electron. It uses an isolated profile under `tmp` and fully restarts the app twice to check that folded panels and the selected navigation contents remain saved.

The installer registers PDF file association support; users choose their default PDF application in Windows Settings. Portable builds do not install themselves or change the user's default application. Distribution artifacts are unsigned unless you configure your own Windows signing certificate. Windows may show an unknown publisher prompt for an unsigned download. Production distribution should use a publisher certificate and a tested update process.

## Document tools

The reader keeps its top controls in two compact rows. Annotation tools sit vertically beside the document; page navigation, fit controls, and zoom sit in the narrow right rail. Fold either side panel with its panel icon to give the document more space. Each panel's open or closed state and selected contents are remembered independently when the app is reopened.

Hold **Ctrl** while moving the **mouse wheel** over the document to zoom in or out around the pointer. The document rerenders at the new scale while the app controls keep their size. Use the wheel normally to scroll, or use the right rail's plus, minus, and fit controls.

- Open local PDFs, switch documents, navigate thumbnails, search selectable text, and adjust zoom and view.

- Add highlights, freehand ink, text, rectangle marks, notes, and a drawn signature; undo and redo annotation changes.

- Export annotated PDFs, page PNGs, extracted text, and document assistance where exposed by the interface.

- Rotate, reorder, remove, extract, and merge pages; add a text watermark.

- Fill supported standard AcroForm text fields, checkboxes, and dropdown fields.

- Print the exported PDF using Windows' print dialog in the desktop application.

New annotations are written as PDF drawing/text content on export. They are flattened, so they are visible in other readers but are not editable Acrobat comment objects. The drawn signature is a visual mark. It is not a certificate signature, identity verification, or a guarantee of legal enforceability.

The included seven-page design report is an original illustrative sample created from vector shapes and embedded PDF text, with no external images required.

## Quality and preservation

PDF.js renders pages at the device's pixel density, including embedded fonts and vector graphics. The app bundles PDF.js resources locally. Saving PDF edits retains PDF page content, vectors, and embedded images instead of converting every page into a screenshot. A PNG export is a raster derivative and is separate from the PDF source.

PDF is a complex format. Verify exported pages before distributing important documents. Rewriting a PDF can invalidate existing digital signatures and may affect advanced PDF features, metadata, structure, and interactive content. Keep the original when working on signed or archival documents. PDF/A and PDF/UA compliance, color-managed prepress, CMYK proofing, and certified accessibility validation are not implemented or guaranteed.

Existing document text can be viewed and searched. This release does not offer arbitrary replacement of existing PDF text, OCR for scanned pages, true security redaction, password removal, certificate signatures, or XFA forms. Drawing an opaque rectangle over text does not remove the underlying information. New annotation text uses the built-in PDF fonts and is limited to their WinAnsi character repertoire; unsupported characters are reported on export rather than silently replaced. Embedded original document fonts remain in the source content.

Encrypted or malformed PDFs may be rejected by the rendering or editing engine. Desktop opening is limited to 300 MB per document, 12 documents per open operation, and 600 MB combined per open operation. Very large or complex pages can still require substantial memory.

## Document assistance and optional local AI

The default document assistant works offline. It retrieves relevant original text excerpts and page references from the open document. Its extractive answers are labeled as local document search; this mode does not call a generative model.

For optional generative responses, install and run [Ollama](https://ollama.com/) separately, download a locally running chat model appropriate for your laptop, and select it in the app. Mapaseo calls only `http://127.0.0.1:11434` from Electron's main process. It does not contain cloud credentials, analytics, cloud document storage, or an adjustable remote AI endpoint. Models marked as remote/cloud are excluded, and model metadata is checked again before document excerpts are sent. No model weights are bundled or downloaded automatically. Configure Ollama for local-only operation if you require strict offline processing; Ollama is a separate program under your control.

Only the selected question and document text context are passed to local inference. The interface uses up to 79,000 characters from the beginning of the document; the desktop bridge enforces an 80,000-character request ceiling and a maximum question length of 8,000 characters. The app requests grounded answers with `[p. N]` citations. Models can still make mistakes or give incorrect citations; use the cited page to verify material claims. Scanned images require OCR before text-based assistance can use their contents.

## Local data and security

The renderer is sandboxed with context isolation and no Node.js integration. Its narrow preload API exposes only specific document operations. The main process validates the sending window and frame for privileged requests. External navigation, new windows, webviews, permissions, and production renderer network requests are blocked. The packaged UI is served through an application protocol restricted to the build directory.

Native saves always require a user-selected Windows Save dialog destination. A renderer cannot specify an arbitrary write path. Opening recent documents is restricted to the stored recent-file whitelist; opening a new path requires the native file chooser or an operating-system file-open action. The recent list stores local paths and opening times in Electron's application data directory. Workspace preferences and recovery data may be stored locally by the interface. Nothing is uploaded by Mapaseo.

Printing creates a temporary PDF in the current user's temporary directory and removes it after the dialog completes or the app exits normally. Windows' print spooler and chosen printer may retain their own job data. An operating-system crash or forced process termination can leave a temporary PDF in a `mapaseo-print-*` folder.

## Source and licenses

Application code is released under the [MIT license](LICENSE). Dependency versions and attributions are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md); original bundled license texts are collected in `THIRD_PARTY_LICENSES.txt`. Run `node scripts/third-party-notices.mjs` after dependency updates and include both notices files when redistributing. PDF.js uses Apache-2.0; pdf-lib, React, React DOM, and Electron use MIT; Lucide uses ISC with its bundled Feather attribution. Electron includes Chromium's separate third-party notices.

Use documents, fonts, and AI models you are authorized to use. Names and artwork in the included sample are illustrative. Dependency license notices do not grant rights to documents a user imports.

## Validation

Run `npm test` for the PDF engine and extractive assistant, `npm run test:ui` for browser workflows (requires Google Chrome), and `npm run test:desktop` after a production build for the real Electron bridge smoke. The desktop smoke isolates its profile under `tmp`, stubs native dialog selections, and stubs only the final printer callback. It does not install the application or alter default PDF settings.

Validated PDF reading, selectable text, high-density rendering, annotation save/reopen, all four page rotations, signatures, page rearrangement and removal, form values, safe links, both side panels at 1366 × 768, dark appearance, native file handling, and sandboxed IPC. Actual printer output and generative model inference require local hardware/software and were not exercised. Production dependency audit reports no known vulnerabilities; the packaging toolchain retains moderate advisories in its development-only dependency chain.

