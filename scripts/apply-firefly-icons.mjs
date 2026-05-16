/**
 * Builds OS / taskbar icons from `public/Firefly (2).png` via `tauri icon`.
 * Use transparent PNGs for no solid background on the taskbar.
 *
 *   Firefly (1).png — in-app (copy into `public/`; used by Vite)
 *   Firefly (2).png — taskbar / bundle (this script)
 *
 * Run: npm run icons:apply
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src2 = path.join(root, 'public', 'Firefly (2).png');
const outBuild = path.join(root, 'src-tauri', 'icons', '_tauri_icon_input.png');

if (!fs.existsSync(src2)) {
  console.warn(
    `[icons:apply] Missing "${path.relative(root, src2)}". Add your Firefly (2).png there, then run npm run icons:apply.`
  );
  process.exit(0);
}

const size = 1024;
await sharp(src2)
  .ensureAlpha()
  .resize(size, size, { fit: 'contain', position: 'centre', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(outBuild);

console.log(`[icons:apply] Wrote ${path.relative(root, outBuild)}`);

execSync(`npx tauri icon "${outBuild}"`, { cwd: root, stdio: 'inherit' });

try {
  fs.unlinkSync(outBuild);
} catch {
  /* ignore */
}

console.log('[icons:apply] Done. Restart Tauri dev / rebuild to refresh the taskbar icon.');
