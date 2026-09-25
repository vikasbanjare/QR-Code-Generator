# Forever Tools

Free web tools that never expire, starting with a **QR Code Generator** and a **Link Shortener**. It's a static site hosted on GitHub Pages, with no server, database or subscription.

## Use it online

**https://vikasbanjare.github.io/QR-Code-Generator/**

It works on any laptop or phone with nothing to install. Every push to the default branch rebuilds the site automatically (`.github/workflows/deploy.yml`).

## QR Code Generator

Every code is **static**: the content is encoded directly into the symbol. There's no redirect, account or subscription, so a printed code keeps working for as long as its destination does. Everything runs in the browser.

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

## Link Shortener

Short links live in [`links.json`](links.json) in this repository. At build time, each entry becomes a static redirect page at `/<name>/`, which works with or without JavaScript.

- **Creating and editing links:** open the Link Shortener and connect a fine-grained GitHub token (Contents: Read and write, only on this repository). The page commits to `links.json`, and the Pages workflow republishes the site, which usually takes 1–2 minutes. The token stays in that browser.
- **Why links don't break:** there's no database or third-party service. A link works for as long as this repository and its Pages site exist. If the token expires, existing links are unaffected.
- **Deleting links:** there's no delete button, on purpose. A deleted link breaks everywhere it was printed or shared, so point it somewhere else instead. To remove one anyway, edit `links.json` on GitHub.
- **Safety:** only `http(s)` destinations are accepted. Invalid entries are skipped at build time, and redirect pages escape their URLs.
- **Limits:** there are no click statistics (no server to count clicks), and the links use this site's address. For shorter links, add a custom domain in *Settings → Pages*. Existing links move with it, but the domain then has to be renewed every year.

## Adding a new tool

1. Build the page in `src/tools/<id>/`.
2. Add an entry to `TOOLS` in `src/site/tools.ts`, which shows it on the landing page, nav and footer.
3. Add one route line in `src/site/Site.tsx`.

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
src/lib/shortlinks.ts short-link validation + redirect page generation
src/lib/github.ts     commits links.json via the GitHub API
src/site/             landing page, header/footer, router, tool registry
src/tools/qr/         QR Code Generator UI
src/tools/links/      Link Shortener UI
links.json            the short links
tests/                vitest suites
```

## Not yet built (per the blueprint roadmap)

Dynamic codes (self-hosted redirects, analytics, editing), bulk CSV generation, the API, EPS export, team workspaces and brand kits beyond templates. These need a backend. The core in `src/lib` has no DOM dependency, apart from `raster.ts`, `scanTest.ts` and `exporters.ts`, so it can be reused server-side.
