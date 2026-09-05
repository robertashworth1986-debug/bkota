# BKOTA — Be Kind One To Another

Arthur Farmer's kindness movement, rooted in Ephesians 4:32. This repository contains the static website, scripture cards, and an interactive, readable merchandise design studio.

## What is included

- Arthur's founder story and a people-first kindness challenge: help comes before filming, and permission comes before sharing.
- [Merchandise studio](merch.html): large front/back views, three palettes, two lettering styles, enlarged artwork, and downloadable editable SVG designs.
- Ephesians 4:32 KJV: a short invitation on the shirt front and the complete verse on the back.
- New AI-generated studio imagery with responsive WebP delivery. Original concepts are preserved and can still be opened at full size.
- Cinematic hands-and-golden-oil artwork with separate desktop/phone compositions, layered cloud lighting, AVIF/WebP delivery, and subtle motion with pause/reduced-motion support. [Artwork provenance](docs/HERO_ARTWORK.md).
- [Scripture cards](kindness-cards.html) and the existing [downloadable card PDF](output/pdf/BKOTA-scripture-cards.pdf).
- A browser-local collection for stories and video links, with an explicit JSON export. Approved public content and private browser entries are kept separate.
- Consent/privacy information and fail-closed service integration. Payment and public-submission features remain disabled in `config.js`.

## Run and verify

Use Node.js 22 or newer; CI uses Node.js 24. Tests and the static build use Node's built-in modules and do not require package installation.

```sh
npm test
npm run build
python -m http.server 8877 --bind 127.0.0.1 --directory dist
```

Open `http://127.0.0.1:8877/` or `http://127.0.0.1:8877/merch.html`. The build creates an allowlisted `dist/` package, including the scripture-card PDF. Unexpected existing build content must be reviewed; the build does not silently delete it. Checks cover local resources, exact verse text, artwork contrast, private collection handling, service receipts, and offline behavior. Automated checks are not a substitute for a printer's physical proof or complete browser/accessibility testing.

To regenerate delivery encodings from the retained image master:

```sh
npm ci --ignore-scripts
npm run media
npm run media:hero
```

Sharp is a development-only media dependency; there are no runtime CDN dependencies. The existing GitHub Pages publishing source is not changed by the quality workflow.

## Production boundaries

The default public preview address is <https://robertashworth1986-debug.github.io/bkota/>. Code on a feature branch is not evidence that the public site has been updated.

Arthur identified **bkota.co** as his domain. On September 5, 2026, it resolved to Shopify and displayed an unavailable-store page; domain connection is not complete. See [domain connection handoff](docs/DOMAIN_CONNECTION.md). No `CNAME` or DNS change is included in this update, and canonical URLs remain on the existing Pages origin until the destination is confirmed.

Connecting a domain does **not** provide public video uploads, durable shared storage, moderation, or checkout. Those need an approved service and moderator/operator accounts. Until then, browser entries are private/local and are not submissions. Clearing browser storage can erase them; JSON exports contain text and video links, not video files. Older imported browser records may have unknown submission history.

The shirt viewer is a spatial vector illustration, not a physically accurate 3D garment simulation. The new merchandise raster master is **1536 × 1024**. The cinematic hero masters are **1672 × 941** (landscape) and **1122 × 1402** (portrait), not native 4K. SVG artwork scales independently of raster resolution, but fonts, inks, underbase, placement, and garment fit must be checked with a printer before manufacture. No stock, sales, fulfillment, or physical product quality is represented as verified.

See [artwork sources, prompt specifications, and print handoff](docs/MERCH_DESIGN_NOTES.md).

All project artwork and content are reserved for the BKOTA project. No license for third-party reuse is granted by this repository.
