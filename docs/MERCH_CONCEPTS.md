# BKOTA premium T-shirt concepts

Status: **visual concept gallery prepared for the static BKOTA release**. Prepared September 12, 2026. These designs are not offered for sale, sent to a printer, or represented as manufactured inventory.

## Exact message and build boundary

Every final concept centers only these three public-safe strings:

1. `BKOTA`
2. `Be Kind One To Another`
3. `Ephesians 4:32`

The text was not entrusted to image generation. Five text-free garment source plates were created with the built-in image-generation tool—one call per distinct concept—and copied unchanged into the non-public `design-sources/merch-v1/` custody directory. `tools/build-merch-concepts.mjs` verifies every source hash and its 1122 × 1402 dimensions, then rasterizes the exact strings and small deterministic ornaments over the reserved chest area. It fails closed if a source changes.

Run the local builder from the repository root:

```powershell
node tools/build-merch-concepts.mjs
```

The retained sources and finals are sRGB PNG files at 1122 × 1402 pixels. The builder does not upscale or invent new detail. It encodes each final as an opaque RGB PNG with compression level 9, creates a 560-pixel-wide WebP delivery preview for the gallery, and does not carry the source C2PA/JUMBF payload or other source metadata into either derivative. `tools/build-static.mjs` publishes deterministically referenced assets plus a small path-and-reason manifest of audited retained assets; it rejects raw source paths, unreferenced files, hidden files, unsupported extensions, active SVG constructs, and unapproved image metadata. It does not include the sibling `design-sources/` directory, which is also ignored by Git so GitHub Pages cannot expose those local plates. The concept builder uses the repository's existing `sharp` dependency and locally installed Georgia, Arial/Arial Narrow, or Trebuchet MS font families. A different operating system or font fallback may change glyph outlines even though the wording and layout constraints remain fixed.

## Concept ledger

### 01 — Midnight Aureole

- Generated source: `design-sources/merch-v1/bkota-concept-01-midnight-aureole-source-v1.png`
- Source SHA-256: `2b81b9d9948a2532d17400b3d7151aef2f2c8ac02cfa755684d1416b10944739`
- Final: `assets/merch/bkota-concept-01-midnight-aureole-v1.png`
- Final SHA-256: `906d284209d922a3a0fc8c50951e47d7e0827b8206ac9901a31abdf25ce2df60`
- Design: midnight heavyweight cotton, fine antique-gold orbital embroidery, warm limestone, Georgia-led editorial typography.

### 02 — Sunday Window

- Generated source: `design-sources/merch-v1/bkota-concept-02-sunday-window-source-v1.png`
- Source SHA-256: `bf36fa1127e2f4b057e3c46b3fabe019e8de8c2a6acec5d2a0510f656b260f81`
- Final: `assets/merch/bkota-concept-02-sunday-window-v1.png`
- Final SHA-256: `698e17f8606a4d8155eb12319d18e8ff02973300660dcb46ddb066ce13642a9e`
- Design: ivory cotton, abstract stained-light edge panels in sapphire/amber/garnet, charcoal surface, clear navy sans-serif message.

### 03 — Evergreen Grove

- Generated source: `design-sources/merch-v1/bkota-concept-03-evergreen-grove-source-v1.png`
- Source SHA-256: `380db41a59e94d8112ef6a5d7d3c0b7fd12231b16d5f1a489ac43622884e722a`
- Final: `assets/merch/bkota-concept-03-evergreen-grove-v1.png`
- Final SHA-256: `c009a827686378d0c221b99f3e95d7834a38026e34ac77db6bc164a17de1ce0e`
- Design: evergreen garment-dyed cotton, olive-branch embroidery at the perimeter, natural oak, warm classic serif typography.

### 04 — Indigo Mended Light

- Generated source: `design-sources/merch-v1/bkota-concept-04-indigo-mended-light-source-v1.png`
- Source SHA-256: `2c23bd15b6f778f695d9d185832dfee2ac5f3eb6f6a5167b2c7871ca294159a7`
- Final: `assets/merch/bkota-concept-04-indigo-mended-light-v1.png`
- Final SHA-256: `66b949099c7faf873026a0c5b8d60a5ad8384eb6e9ea45b276406b13ad2c10b7`
- Design: washed indigo slub cotton, copper and pale-denim running stitches, cool slate surface, condensed workwear typography.

### 05 — Oxblood Unity

- Generated source: `design-sources/merch-v1/bkota-concept-05-oxblood-unity-source-v1.png`
- Source SHA-256: `7ad5f0623446cf35a78552256b0d1a4c2eedda709f63c6abe07353a6b4bc4d45`
- Final: `assets/merch/bkota-concept-05-oxblood-unity-v1.png`
- Final SHA-256: `0faca2d8222a8d54eab04d90a2b67058e8ced6555a04b4501b0e0eea5fc29fc4`
- Design: oxblood brushed cotton, interlocking blush/clay/gold ribbons suggesting connection, rose-beige travertine, humane modern typography.

## Image-generation prompts

The following are the complete production prompts used for the five built-in image-generation calls. No input image was supplied to any call.

### Prompt 01 — Midnight Aureole

```text
Use case: product-mockup
Asset type: premium T-shirt concept source plate for a local design presentation
Primary request: Create one original, text-free flat-lay product concept of a single heavyweight crew-neck T-shirt in deep midnight navy. The shirt is the complete front view, laid perfectly flat and centered on a warm pale limestone studio surface. Add only subtle, refined metallic-gold embroidered concentric halo arcs around the OUTER chest, shoulders, and lower torso, forming an elegant aureole frame while keeping a large uninterrupted blank rectangular print zone in the center of the chest.
Subject: one unbranded adult T-shirt, no model, no hanger, no packaging
Style/medium: photorealistic premium editorial product photography with realistic cotton grain, ribbed collar, seams, gentle folds, and restrained luxury styling
Composition/framing: portrait 4:5 presentation, top-down, symmetrical, full garment visible with generous margins; central chest print zone at least 45% of garment width and 32% of garment height, plain navy and high-contrast-ready
Lighting/mood: soft directional studio light, quiet, dignified, warm
Color palette: midnight navy, antique gold accents, pale warm stone
Materials/textures: heavyweight garment-dyed cotton, fine embroidered metallic thread, matte limestone
Text: NONE
Constraints: genuinely no text, no letters, no numbers, no words, no typographic shapes, no logos, no neck label, no hang tag, no watermark; keep every decorative element outside the central blank chest print zone; original design only; concept image, not evidence of manufactured inventory
Avoid: people, hands, religious icons, crosses, crowns, branded apparel, prices, retail tags, mock store graphics, extra garments, clutter, illegible pseudo-text
```

### Prompt 02 — Sunday Window

```text
Use case: product-mockup
Asset type: premium T-shirt concept source plate for a local design presentation
Primary request: Create one original, text-free flat-lay product concept of a single heavyweight crew-neck T-shirt in warm Sunday ivory. The complete front is laid perfectly flat and centered on a deep charcoal studio surface. Across the shoulders, sleeve edges, and lower side panels, add restrained translucent stained-light geometry: irregular jewel-like panes and soft projected light in sapphire blue, amber gold, and a trace of garnet, with fine antique-gold lines. Keep the entire central chest as a clean uninterrupted ivory print zone.
Subject: one unbranded adult T-shirt, no model, no hanger, no packaging
Style/medium: photorealistic premium editorial product photography; contemporary sacred-architecture mood without depicting any religious symbol
Composition/framing: portrait 4:5 presentation, top-down, symmetrical, full garment visible with generous margins; central chest print zone at least 48% of garment width and 34% of garment height, plain ivory and high-contrast-ready
Lighting/mood: controlled museum-like light, luminous but quiet, refined
Color palette: warm ivory, charcoal, sapphire, amber gold, tiny garnet accents
Materials/textures: heavyweight loopwheel cotton, ribbed collar, stitched seams, subtle translucent light and screenprint texture
Text: NONE
Constraints: genuinely no text, no letters, no numbers, no words, no typographic shapes, no logos, no neck label, no hang tag, no watermark; decorative geometry only around the perimeter and outside the large blank central chest zone; original design only; concept image, not evidence of manufactured inventory
Avoid: people, hands, crosses, crowns, church logos, denominational symbols, branded apparel, prices, retail tags, extra garments, clutter, illegible pseudo-text
```

### Prompt 03 — Evergreen Grove

```text
Use case: product-mockup
Asset type: premium T-shirt concept source plate for a local design presentation
Primary request: Create one original, text-free flat-lay product concept of a single heavyweight crew-neck T-shirt in deep evergreen forest green. The complete front is laid perfectly flat and centered on a warm weathered oak studio surface. Add delicate botanical screenprint and embroidery details only along the shoulders and lower side seams: graceful olive branches, small leaves, and seed-like dots in muted warm ivory and antique brass. The foliage should loosely frame, but never enter, a large plain central chest print zone.
Subject: one unbranded adult T-shirt, no model, no hanger, no packaging
Style/medium: photorealistic premium heritage apparel editorial, restrained craft detail, clean contemporary finish
Composition/framing: portrait 4:5 presentation, top-down, symmetrical, full garment visible with generous margins; central chest print zone at least 46% of garment width and 34% of garment height, uninterrupted evergreen and high-contrast-ready
Lighting/mood: soft late-afternoon window light, grounded, generous, quietly hopeful
Color palette: deep evergreen, warm ivory, antique brass, natural oak
Materials/textures: heavyweight garment-dyed cotton, fine chain-stitch embroidery, matte water-based print, weathered wood grain
Text: NONE
Constraints: genuinely no text, no letters, no numbers, no words, no typographic shapes, no logos, no neck label, no hang tag, no watermark; keep all foliage outside the central blank chest print zone; original design only; concept image, not evidence of manufactured inventory
Avoid: people, hands, religious icons, crosses, crowns, branded apparel, prices, retail tags, extra garments, clutter, illegible pseudo-text, floral bouquet in the center
```

### Prompt 04 — Indigo Mended Light

```text
Use case: product-mockup
Asset type: premium T-shirt concept source plate for a local design presentation
Primary request: Create one original, text-free flat-lay product concept of a single heavyweight crew-neck T-shirt in softly washed natural indigo. The complete front is laid perfectly flat and centered on a cool dark slate studio surface. Add sparse hand-mended visual details only around the shoulders and lower outer torso: elegant broken-line arcs, tiny running stitches, and a few repaired-seam pathways in muted copper-gold and pale denim blue, suggesting restoration and connection. Keep a large plain central chest print zone completely free of decoration.
Subject: one unbranded adult T-shirt, no model, no hanger, no packaging
Style/medium: photorealistic premium Japanese-workwear-inspired editorial product photography, tactile and understated, original contemporary arrangement
Composition/framing: portrait 4:5 presentation, top-down, symmetrical, full garment visible with generous margins; central chest print zone at least 46% of garment width and 34% of garment height, uninterrupted indigo and high-contrast-ready
Lighting/mood: cool softbox light with restrained copper highlights, reflective, resilient, premium
Color palette: washed indigo, cool slate, muted copper-gold, pale denim
Materials/textures: heavyweight slub cotton, visible garment-dye variation, fine running stitches, matte repaired seams
Text: NONE
Constraints: genuinely no text, no letters, no numbers, no words, no typographic shapes, no logos, no neck label, no hang tag, no watermark; keep all stitch artwork outside the central blank chest print zone; original design only; concept image, not evidence of manufactured inventory
Avoid: people, hands, religious icons, crosses, crowns, branded apparel, prices, retail tags, extra garments, clutter, illegible pseudo-text, central patch or central emblem
```

### Prompt 05 — Oxblood Unity

```text
Use case: product-mockup
Asset type: premium T-shirt concept source plate for a local design presentation
Primary request: Create one original, text-free flat-lay product concept of a single heavyweight crew-neck T-shirt in rich oxblood burgundy. The complete front is laid perfectly flat and centered on a soft rose-beige travertine studio surface. Add an abstract unity motif made from smooth continuous ribbon lines in warm blush, muted clay, and antique-gold foil: the ribbons interlock gently along the shoulders and lower side panels and suggest people connecting without forming letters or recognizable logos. Keep a large, plain burgundy central chest print zone completely clear.
Subject: one unbranded adult T-shirt, no model, no hanger, no packaging
Style/medium: photorealistic premium fashion editorial product photography, sculptural minimalism, understated luxury
Composition/framing: portrait 4:5 presentation, top-down, symmetrical, full garment visible with generous margins; central chest print zone at least 46% of garment width and 34% of garment height, uninterrupted oxblood and high-contrast-ready
Lighting/mood: soft rose-gold studio light, humane, confident, celebratory without being loud
Color palette: oxblood burgundy, warm blush, terracotta clay, antique gold, pale travertine
Materials/textures: heavyweight brushed cotton, satin-stitch ribbon lines, selective matte foil, stone grain
Text: NONE
Constraints: genuinely no text, no letters, no numbers, no words, no typographic shapes, no logos, no neck label, no hang tag, no watermark; keep all ribbon artwork outside the central blank chest print zone; original design only; concept image, not evidence of manufactured inventory
Avoid: people, literal hands, faces, religious icons, crosses, crowns, branded apparel, prices, retail tags, extra garments, clutter, illegible pseudo-text, central emblem
```

## Visual inspection notes

All five final PNGs were inspected at their original 1122 × 1402 resolution after deterministic assembly.

| Concept | Confirmed | Known limitations or flaws |
| --- | --- | --- |
| Midnight Aureole | Complete centered garment; blank source chest; exact high-contrast copy; restrained gold frame; no generated words, logo, label, watermark, person, or sales cue. | The gold ornament is a rendered concept, not embroidery specifications; the deterministic type remains planar rather than physically displaced by the small cotton folds. |
| Sunday Window | Complete centered garment; exact navy/gold copy remains clear against ivory; stained-light geometry stays outside the message; no stray generated text. | The edge treatment combines projected-light and print-like cues, so a production artist would need to decide the actual print/embroidery method and reduce it to separations. |
| Evergreen Grove | Complete centered garment; exact copy is clear; plant frame does not collide with the message; no generated text. | Loose olive branches appear as set dressing in two background corners. The concept does not establish exact botanical stitch count, ink count, or garment manufacturability. |
| Indigo Mended Light | Complete centered garment; exact copy is clear; stitch field remains peripheral; no generated text. | The source intentionally shows irregular garment-dye variation and decorative repairs; the crisp planar wording does not simulate ink absorption or fabric deformation. |
| Oxblood Unity | Complete centered garment; exact copy is clear; ribbon motif frames rather than obscures it; no generated text. | Dried stems and partial stone forms appear as background set dressing. The ribbon/foil treatment is illustrative and has not been converted to vendor-ready vector separations. |

Across all five, no physical garment, printer sample, wash test, accessibility study, customer preference study, supplier quote, inventory, checkout, or sale was created or verified. The images are concept boards, not print masters or product photographs. Their raster size is not a native-4K claim.

## Provenance, rights, and licensing boundary

- Mode: OpenAI built-in image generation. Exactly five generation calls were used, one for each distinct text-free source plate. No CLI/API-key fallback was used.
- Inputs: no photographs, stock assets, third-party artwork, or reference images were passed into generation. The repository's existing BKOTA studio image and design notes were inspected only to avoid duplication and maintain palette continuity; they were not generation inputs.
- Custody: each tool-produced PNG was copied unchanged into the non-public `design-sources/merch-v1/` directory and bound to the builder by SHA-256. The recursive public `assets/` tree contains only the metadata-stripped final derivatives produced locally by the checked-in builder; it contains no raw generation source directory.
- Typography: the builder rasterizes text with local system fonts. No font binary or third-party stock asset was added to the repository. The final PNGs do not grant a redistributable font license or replace a printer's font/outlining review.
- Rights boundary: this record establishes process provenance and byte identity, not copyright originality, trademark clearance, exclusivity, or legal advice. Use of generated outputs remains subject to the applicable OpenAI terms and the project's rights review. `BKOTA` is treated as project-supplied wording; no trademark-registration claim is made.
- Release boundary: the project operator's September 12, 2026 go-live approval covers publishing these five clearly labeled concept boards in the static gallery for Arthur's review. It does not represent Arthur's selection of a preferred direction, manufacturing approval, or permission to sell or license a design.
- Reuse boundary: these concepts do not themselves grant third-party reuse rights. Before sale, manufacture, or licensing, Arthur/the BKOTA owner should select a direction, confirm brand ownership/clearance, approve the exact message and colors, and obtain printer-ready vector separations plus a physical proof.

The gallery integration, lightweight delivery previews, static-release manifest, and tests are part of the reviewed website release. Checkout, inventory, payment, fulfillment, and printer production remain outside this work.
