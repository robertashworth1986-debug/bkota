# BKOTA merchandise design handoff

Prepared September 5, 2026 for Arthur Farmer's BKOTA movement.

## Readable artwork

The front leads with **BE KIND / ONE TO / ANOTHER**, with **EPHESIANS 4:32**. The back includes the full verse already used by the project:

> And be ye kind one to another, tenderhearted, forgiving one another, even as God for Christ's sake hath forgiven you.

Ephesians 4:32, King James Version. The artwork uses a typographic apostrophe in “Christ’s”; the wording is unchanged.

`merch.js` generates the chosen front/back artwork deterministically. Midnight, Sunday, and Evergreen palettes support bold sans-serif and classic serif lettering. Actual vector text carries the message; the raster mockup is not the printing source. Tests cover the twelve combinations and their screen contrast.

The two no-JavaScript fallback sources are:

- `assets/merch/bkota-front-midnight.svg`
- `assets/merch/bkota-back-midnight.svg`

Artboards are 12 × 15 inches with a 4000 × 5000 coordinate grid and transparent backgrounds. They are editable design sources, not vendor-approved print proofs. The interactive studio also exports the selected palette/typeface as SVG.

## Generated imagery and provenance

Mode: **built-in image generation**, followed by one targeted built-in image edit. No API-key/CLI fallback was used.

Reference image: the existing `assets/shirt-bkota-classic.png`, inspected before generation. Its role was brand/design reference, not a photograph of verified manufactured inventory. The original reference and other earlier concepts are preserved.

Final project master: `assets/merch/bkota-studio-v2.png` — 1536 × 1024 pixels. This is an AI-generated product concept, not a product photograph or a native 4K file.

Responsive delivery files:

- `assets/merch/bkota-studio-v2.webp` — 1536 × 1024.
- `assets/merch/bkota-studio-v2-800.webp` — 800 × 533.

The media script only encodes/resizes delivery copies and retains the unchanged PNG master; it does not claim to recover new detail through upscaling.

### Prompt set — concise reproduction specifications

These specifications summarize the generation and targeted edit, rather than claiming to reproduce every character of the tool-call transcript.

**Generation: product-mockup.** Create a refined BKOTA website product image, using the existing Classic shirt as the design reference. Show two upright, front-facing heavyweight cotton shirts, navy in the foreground and ivory beside it, with complete fronts visible. Use realistic three-dimensional studio rendering, crisp cotton texture and stitching, and a warm stone backdrop. Render the exact large, readable serif wording “BE KIND / ONE TO / ANOTHER” with “EPHESIANS 4:32” below it. Preserve the navy, ivory, and gold identity; place subtle gold ripple rings behind the shirts without interfering with their lettering. Use a landscape 3:2 composition. No people, unrelated props, prices, watermarks, or claims of manufactured inventory.

**Targeted edit: text contrast.** Change only “EPHESIANS 4:32” on the right-hand ivory shirt from gold to deep ink navy matching its headline. Preserve the shirts, headline wording, layout, fabric, lighting, backdrop, and other artwork.

The generated result and the contrast edit were visually inspected. The dedicated studio was inspected at one desktop browser size; complete mobile/device and assistive-technology testing is still a release follow-up, not a claimed result.

## Printer handoff

1. Choose the front/back palette and typeface in the studio and download both SVG files.
2. Confirm the wording and garment color with Arthur. The design source contains editable text requiring Arial/Helvetica or Georgia/Times font availability.
3. Have the printer verify the exact fonts or convert text to outlines. Font substitution can change line widths.
4. Confirm final print dimensions/placement for each garment size, ink colors, printing method, underbase, and fabric compatibility.
5. Approve a physical sample for readability, color, placement, wash durability, and comfort before placing a production order.

Screen contrast tests do not certify ink/fabric contrast. The garment preview is a spatial vector illustration, not a cloth simulation, physical sample, supplier proof, or guarantee of print quality. No order, checkout, inventory, or supplier contract is enabled by these files.
