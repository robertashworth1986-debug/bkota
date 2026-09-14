# Arthur Farmer BKOTA social card

The social-preview card is symbolic campaign artwork created for Arthur Farmer's BKOTA movement. It is not a photograph of a divine event, a donor, or a documented act of kindness. The built-in image-generation tool produced the text-free scene; `npm run media:social` adds all lettering deterministically so Arthur's name, BKOTA, and Ephesians 4:32 cannot be misspelled by an image model.

## Text-free generation prompt

```text
Use case: ads-marketing
Asset type: cinematic website and social sharing card background, designed to be cropped to 1200x630
Primary request: Create a premium, photorealistic evolution of the referenced BKOTA scene: two compassionate open hands emerging from radiant clouds, gently holding luminous golden oil that pours downward in one elegant continuous stream. Preserve the spiritual warmth, dignity, realism, and unmistakable hands-and-oil concept.
Input images: Image 1 is the visual identity reference and composition reference.
Scene/backdrop: vast sunrise sky above a peaceful landscape; deep midnight-blue atmosphere on the left blending into radiant gold on the right.
Subject: realistic diverse human hands, anatomically correct, palms open, with luminous golden oil pooling naturally and flowing with convincing viscosity and surface reflections.
Style/medium: cinematic high-end photorealistic campaign image, editorial lighting, realistic skin pores, physically convincing liquid, tasteful and reverent rather than fantasy kitsch.
Composition/framing: wide landscape, hands fully visible in the upper-right third, golden stream descending along the right third, generous clean dark-blue negative space across the left 48 percent for later typography; keep all important content inside a central safe area.
Lighting/mood: transcendent warm sunrise, hopeful, welcoming, peaceful, human, award-quality.
Color palette: midnight navy, warm ivory, restrained antique gold, sunrise amber.
Materials/textures: realistic skin and translucent liquid with restrained optical highlights.
Constraints: NO text, NO letters, NO logos, NO symbols, NO watermark; do not crop fingers or wrists; exactly two hands; anatomically correct fingers; one coherent oil pool and one main stream; no extra people, faces, jewelry, objects, or containers. The left side must remain visually quiet enough for crisp white and gold title typography to be added later.
```

The returned source is retained outside the public website tree at `design-sources/social-v1/bkota-social-card-source-v1.png` and was inspected as a **1730 by 909** PNG. Its SHA-256 is `d862fef0eaf2751bdb1f767666cc4cbb84ff89f3b7538677a5af39c006a95b6c`; the deterministic builder verifies that hash and the source dimensions before processing. The source is deliberately absent from the static release manifest.

The builder crops it to the standard social-preview aspect ratio, adds the exact approved words as an SVG overlay, and writes `assets/bkota-social-card-v1.png` as an exact **1200 by 630** PNG. The current final SHA-256 is `132f23f214cc3beac9d89f6f7ff2e9a415e9a121d37d33dadb313aef31cc5557`.

The visible card text is:

- `BKOTA`
- `ARTHUR FARMER'S ORIGINAL VISION`
- `Be kind.`
- `One to another.`
- `EPHESIANS 4:32`
- `One kind act. Pass it on.`

The homepage uses the final card for both Open Graph and Twitter preview metadata. Tests verify its format, dimensions, bounded file size, and exact local public URL. The source artwork remains separate from the website hero so changing a social crop cannot move the live hands or oil on the homepage.
