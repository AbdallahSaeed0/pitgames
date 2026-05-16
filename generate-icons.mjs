import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputPath = path.join(__dirname, 'src-tauri', 'icons', 'logo.png');
const outputDir = path.join(__dirname, 'src-tauri', 'icons');

async function generateIcons() {
  console.log('Generating icons from logo.png...');

  try {
    // Generate 32x32 PNG
    await sharp(inputPath)
      .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(outputDir, '32x32.png'));
    console.log('✓ Generated 32x32.png');

    // Generate 128x128 PNG
    await sharp(inputPath)
      .resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(outputDir, '128x128.png'));
    console.log('✓ Generated 128x128.png');

    // Generate 128x128@2x PNG
    await sharp(inputPath)
      .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(outputDir, '128x128@2x.png'));
    console.log('✓ Generated 128x128@2x.png');

    // Generate icon.png (256x256)
    await sharp(inputPath)
      .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toFile(path.join(outputDir, 'icon.png'));
    console.log('✓ Generated icon.png (256x256)');

    console.log('\n✅ All PNG icons generated successfully!');
    console.log('Note: .ico and .icns files need to be generated via ImageMagick or similar.');
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
