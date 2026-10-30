import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const inputDir = 'C:\\Users\\busar\\.gemini\\antigravity-ide\\brain\\20956a53-8a01-4c9f-a2db-ab4c99676f00';
const outputDir = 'd:\\Fishes\\public\\assets';

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 1. Process Ocean Background (optimize size and copy)
const oceanBgSrc = path.join(inputDir, 'ocean_sunlight_bg_1789887994014.jpg');
await sharp(oceanBgSrc)
  .resize(1920, 1080, { fit: 'cover' })
  .jpeg({ quality: 88, progressive: true })
  .toFile(path.join(outputDir, 'ocean_bg.jpg'));
console.log('ocean_bg.jpg created');

// Helper to remove black background and produce clean alpha
async function removeBlackBackground(inputPath, outputPath, options = {}) {
  const { threshold = 18, softRange = 25, trim = true } = options;
  const image = sharp(inputPath);
  const metadata = await image.metadata();

  // Get raw pixel buffer (RGBA)
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const numPixels = info.width * info.height;
  for (let i = 0; i < numPixels; i++) {
    const offset = i * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];

    // Max component / brightness
    const brightness = Math.max(r, g, b);

    if (brightness <= threshold) {
      data[offset + 3] = 0; // Completely transparent
    } else if (brightness < threshold + softRange) {
      // Smooth feathering
      const alphaFactor = (brightness - threshold) / softRange;
      data[offset + 3] = Math.round(alphaFactor * 255);
    }
  }

  let processed = sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4
    }
  });

  if (trim) {
    processed = processed.trim();
  }

  await processed.png({ compressionLevel: 8 }).toFile(outputPath);
  console.log(`${path.basename(outputPath)} created successfully`);
}

// 2. Process Hero Sea Fish
const heroFishSrc = path.join(inputDir, 'hero_sea_fish_1789888023751.jpg');
await removeBlackBackground(heroFishSrc, path.join(outputDir, 'hero_fish.png'), {
  threshold: 15,
  softRange: 20
});

// 3. Process Tiger Prawn
const prawnSrc = path.join(inputDir, 'tiger_prawn_isolated_1789888043234.jpg');
await removeBlackBackground(prawnSrc, path.join(outputDir, 'tiger_prawn.png'), {
  threshold: 16,
  softRange: 22
});

// 4. Process Fish School / Bait ball
const schoolSrc = path.join(inputDir, 'fish_school_isolated_1789888064137.jpg');
await removeBlackBackground(schoolSrc, path.join(outputDir, 'fish_school.png'), {
  threshold: 14,
  softRange: 25
});

console.log('All photorealistic assets processed!');
