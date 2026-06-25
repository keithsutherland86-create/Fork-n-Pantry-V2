import sharp from "sharp";

const src = "C:/Users/User/Downloads/file_0000000056bc71fa9ba5247c16a806c6.png";

const meta = await sharp(src).metadata();
console.log(`Source: ${meta.width}x${meta.height}`);

// Crop the circular logo from the centre of the source image
const cropSize = Math.round(meta.height * 0.92);
const left = Math.round((meta.width - cropSize) / 2);
const top = Math.round((meta.height - cropSize) / 2);
console.log(`Cropping: ${cropSize}x${cropSize} from (${left},${top})`);

const cropped = await sharp(src)
  .extract({ left, top, width: cropSize, height: cropSize })
  .resize(512, 512)
  .png()
  .toBuffer();

// Standard icons (purpose: "any") — used as-is on all platforms
await sharp(cropped).resize(512, 512).png().toFile("public/icons/icon-512.png");
console.log("✓ icon-512.png");

await sharp(cropped).resize(192, 192).png().toFile("public/icons/icon-192.png");
console.log("✓ icon-192.png");

await sharp(cropped).resize(32, 32).png().toFile("public/favicon.png");
console.log("✓ favicon.png");

// Maskable icon (purpose: "maskable") — logo at 80% with dark green background padding
// Android safe-zone requires the focal content to fit within the centre 80% circle
const MASK_SIZE = 512;
const LOGO_SIZE = Math.round(MASK_SIZE * 0.78); // logo occupies 78% — fits safe zone
const pad = Math.round((MASK_SIZE - LOGO_SIZE) / 2);

const logoResized = await sharp(cropped).resize(LOGO_SIZE, LOGO_SIZE).png().toBuffer();

await sharp({
  create: { width: MASK_SIZE, height: MASK_SIZE, channels: 4, background: { r: 30, g: 52, b: 38, alpha: 1 } }
})
  .composite([{ input: logoResized, top: pad, left: pad }])
  .png()
  .toFile("public/icons/icon-512-maskable.png");
console.log("✓ icon-512-maskable.png — Done!");
