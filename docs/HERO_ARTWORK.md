# Hands of kindness: cinematic hero artwork

Arthur's existing hands-through-clouds and golden-oil concept is the visual reference. The new image is symbolic artwork made with the built-in image-generation tool, not a photograph of an event or a physically simulated 3D scene. Original artwork remains in assets/.

## Generation prompt

```text
Use case: product-independent cinematic illustration, precise-object-edit.
Asset type: BKOTA homepage hero, a compassionate Christian kindness movement honoring Arthur Farmer's original vision.
Input image: the attached existing BKOTA hands-of-kindness landscape is the edit target and composition/identity reference. Preserve its core symbol: exactly two anatomically convincing human hands emerging through luminous clouds, cupped together and pouring a continuous stream of transparent golden anointing oil toward the earth at sunrise.
Primary request: re-render this artwork with exceptional fine detail and convincing premium 3D-rendered depth. Request a native 3840 by 2160 landscape image if available. Make the clouds richly volumetric with layered depth, delicate sunbeams, soft atmospheric scattering, warm ivory edges and deep midnight-navy shadows. Make the hands natural and dignified: realistic skin grain, subtle palm creases, translucent warm rim lighting, correct finger anatomy, no extra fingers or merged hands. The oil must look like clean translucent amber-gold liquid, with realistic viscosity, bright caustics, glinting droplets and a graceful flowing ribbon, not yellow paint, metal, or fire. Build a peaceful, detailed distant landscape along the lower edge with atmospheric perspective.
Composition constraints: keep the full pair of cupped hands in the right half, around x=76 percent and y=30 percent; the oil emerges around x=74 percent y=42 percent and flows downward. Both hands remain complete and uncropped, wrist ends dissolve softly into clouds. Keep the left 45 percent dark navy and visually quiet for live website text, never paint text into the image. Keep the hand pair compact enough to remain together in a portrait crop centered around the oil. Retain the warm gold/navy BKOTA identity and sense of welcome, generosity, hope and reverence. Give the image depth through light, volume and material detail, not excessive visual effects.
Avoid: text, lettering, logos, watermarks, captions, UI, frames, human faces, extra hands, deformed fingers, jewelry, bowls, bottles, aggressive spectacle, flames, overexposure, noisy particles, plasticky skin, fake lens blur over the subject. This is symbolic artwork, not a claim of a photographed event.
```

The requested image dimensions in the prompt are a request, not proof of the returned dimensions. The inspected landscape master is 1672 × 941 pixels, retained unchanged as `assets/hands-of-kindness-v2.png`. It is not a native 3840 × 2160 image, and delivery files are not upscaled to imply additional detail.

## Portrait companion prompt

```text
Use case: precise-object-edit, cinematic symbolic illustration.
Asset type: portrait mobile hero for Arthur Farmer's BKOTA kindness website.
Input image 1 is the final landscape artwork and edit target. Input image 2 is the older portrait composition reference only. Recompose image 1 into an exceptional portrait 4:5 mobile companion, retaining the same natural hands, translucent amber-gold oil, deep midnight-navy / warm gold colors, richly dimensional volumetric clouds and sunrise landscape. Do not reproduce the older image's lower detail.
Request native 2048 x 2560 if available. Exactly two natural, anatomically convincing cupped hands emerge through the upper glowing clouds and pour a single long stream of liquid golden oil toward the earth. The complete pair of hands must be fully visible, with comfortable margins on both sides, centered around x=57 percent, y=26 percent; occupy about 55 percent of image width, not almost all of it. The oil emerges around x=56 percent y=38 percent and travels down toward the bottom. Keep hand details, realistic skin/palm creases, refractive amber fluid, subtle glints and small droplets, delicate sunbeams and glowing cloud edges extremely crisp. Warm landscape low at the bottom, deep navy cloud shadow along left edge and lower-left. Peaceful, hopeful, reverent, generous, not aggressive spectacle.
This is an art-directed portrait version of image 1, not a crop that cuts off hands. Keep the complete hands and long liquid stream easily understandable on a small phone. Website typography will be separate live text below the image: put no text into the image.
Avoid extra hands/fingers, deformed anatomy, bowls, bottles, jewelry, faces, lettering, captions, watermarks, UI, flames, yellow paint, metallic solid oil, overexposed skin, plasticky texture or oversharpened halos. Symbolic artwork, not a photographed event.
```

The inspected portrait master is **1122 × 1402** pixels, retained unchanged as `assets/hands-of-kindness-v2-mobile.png`. Both complete hands are visible with side margins. The design separates the phone's image stage from the live headline; it does not squeeze a desktop background behind several lines of mobile text.

## Website delivery and motion

`npm run media:hero` creates AVIF and WebP encodings from the retained PNG masters, without cropping or upscaling:

- `assets/hands-of-kindness-v2.avif` and `.webp`: full landscape dimensions.
- `assets/hands-of-kindness-v2-1120.avif` and `.webp`: 1120-pixel-wide landscape delivery.
- `assets/hands-of-kindness-v2-mobile.avif` and `.webp`: full portrait dimensions.

The original `hands-of-kindness-hero*` artwork remains unchanged. The homepage's full-size-artwork link opens the new landscape master. Website words remain live HTML text, not image lettering.

The still illustrations have a three-dimensional rendered appearance, not an interactive geometry-based 3D model. Subtle canvas oil glints and layered CSS cloud movement are decorative enhancements. Oil coordinates are measured relative to the source image, translated through its cover crop using untransformed local dimensions, and refreshed after responsive source loads. Phone artwork does not use the desktop scale animation. Pause, reduced-motion, data-saver, and visibility controls are retained.

The returned images are not native UHD/4K despite the requested prompt dimensions. No resampling is presented as newly generated detail. The generated masters were visually inspected; full end-to-end browser/device testing of this updated hero is not claimed.
