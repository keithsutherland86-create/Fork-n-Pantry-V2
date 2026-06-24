import sharp from "sharp";

const src = "C:/Users/User/Downloads/Gemini_Generated_Image_20428v20428v2042.png";

// Get image dimensions first
const meta = await sharp(src).metadata();
console.log(`Source: ${meta.width}x${meta.height}`);

// The icon sits centered in the image with white padding around it.
// Crop to just the wooden icon square (approximately 58% of width, centered).
const cropSize = Math.round(meta.height * 0.72);
const left = Math.round((meta.width - cropSize) / 2);
const top = Math.round((meta.height - cropSize) / 2);

console.log(`Cropping: ${cropSize}x${cropSize} from (${left},${top})`);

await sharp(src)
  .extract({ left, top, width: cropSize, height: cropSize })
  .resize(512, 512)
  .png()
  .toFile("public/icons/icon-512.png");
console.log("✓ icon-512.png");

await sharp(src)
  .extract({ left, top, width: cropSize, height: cropSize })
  .resize(192, 192)
  .png()
  .toFile("public/icons/icon-192.png");
console.log("✓ icon-192.png");

await sharp(src)
  .extract({ left, top, width: cropSize, height: cropSize })
  .resize(32, 32)
  .png()
  .toFile("public/favicon.png");
console.log("✓ favicon.png — Done!");
