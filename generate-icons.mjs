import sharp from "sharp";

const src = "C:/Users/User/Downloads/file_0000000056bc71fa9ba5247c16a806c6.png";

// Get image dimensions first
const meta = await sharp(src).metadata();
console.log(`Source: ${meta.width}x${meta.height}`);

// Circular logo centred on white background, 1536x1024.
// Crop a square slightly smaller than the height to capture the full circle.
const cropSize = Math.round(meta.height * 0.92);
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
