# QR Studio

A static QR code generator with a design studio and a scan-safety engine. This is the MVP from the product blueprint.

Every code is **static**: the content is encoded directly into the symbol. There is no redirect, no account and no subscription, so a printed code keeps working for as long as its destination does. Everything runs in the browser, and no content leaves the device.

## What's in the MVP

| Area | Included |
| --- | --- |
| Content types | URL, text, phone, SMS, email, Wi-Fi, vCard contact, UPI payment |
| Body styles | square, rounded, dots, diamond, vertical bars, horizontal bars |
| Eyes | 4 frame shapes × 5 ball shapes, each with its own colour |
| Colour | foreground, background, transparent background, linear/radial gradients (optionally on the eyes) |
| Logo | PNG/JPG/WebP/SVG, size, square/circle mask, background plate, padding |
| Frame / CTA | border, label above, label below |
| Templates | 6 built in, plus your own saved in the browser |
| Export | SVG (with the validation report embedded), 300 dpi PNG, vector PDF at the print size, JSON validation report |

### Scan-safety engine

Checks re-run live on every change:

- **Contrast**: body, each eye colour, and the weakest point of a gradient against the background (fails below 3:1, warns below 4.5:1)
- **Polarity**: warns on light-on-dark codes
- **Quiet zone**: locked at 4 modules or more
- **Logo coverage**: compares the modules the logo hides with the error-correction budget. The logo is automatically kept off the finder patterns, and error correction is raised to H when the content fits.
- **Data density**: warns on dense (high-version) symbols
- **Print size**: module size in mm for the chosen print width, plus an approximate scan distance
- **Call-to-action legibility**
- **Decode test**: the rendered SVG is rasterised and read back with [ZXing](https://github.com/zxing-cpp/zxing-cpp) (WebAssembly) in three conditions: sharp and large, small (3 px per module), and a simulated camera (blur plus a 12° tilt)

If any check fails, exporting needs an explicit confirmation.

## Use it online

**https://vikasbanjare.github.io/QR-Code-Generator/**

It works on any laptop or phone with nothing to install. Every push to the default branch rebuilds the site automatically (`.github/workflows/deploy.yml`).

## Development

```bash
npm install
npm run dev        # local dev server
npm test           # unit + decode round-trip tests
npm run typecheck
npm run build      # static site in dist/
```

The test suite renders every body × eye-frame × eye-ball combination (120 of them), plus logo, gradient and frame variants. It rasterises each one with resvg at two sizes and requires ZXing to decode it.

## Layout

```
src/lib/payloads.ts   content → QR payload encoders and validation
src/lib/matrix.ts     QR matrix + error-correction resolution
src/lib/render.ts     SVG renderer (single source for all exports)
src/lib/safety.ts     scan-safety checks
src/lib/scanTest.ts   decode-after-render test (browser)
src/lib/exporters.ts  SVG / PNG / PDF / report downloads
src/components/       React UI
tests/                vitest suites
```

## Not yet built (per the blueprint roadmap)

Dynamic codes (self-hosted redirects, analytics, editing), bulk CSV generation, the API, EPS export, team workspaces and brand kits beyond templates. These need a backend. The core in `src/lib` has no DOM dependency, apart from `raster.ts`, `scanTest.ts` and `exporters.ts`, so it can be reused server-side.
