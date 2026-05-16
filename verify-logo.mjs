import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('\n🔍 PitGames Logo Integration Verification\n');
console.log('=' .repeat(50));

const checks = [];

// Check 1: Icon files exist
console.log('\n✓ Checking icon files...');
const requiredIcons = [
  'src-tauri/icons/32x32.png',
  'src-tauri/icons/128x128.png',
  'src-tauri/icons/128x128@2x.png',
  'src-tauri/icons/icon.ico',
  'src-tauri/icons/icon.icns',
  'src/assets/logo.png'
];

requiredIcons.forEach(icon => {
  const fullPath = path.join(__dirname, icon);
  if (fs.existsSync(fullPath)) {
    const size = fs.statSync(fullPath).size;
    console.log(`  [OK] ${icon} (${size} bytes)`);
    checks.push(true);
  } else {
    console.log(`  [FAIL] ${icon} NOT FOUND`);
    checks.push(false);
  }
});

// Check 2: tauri.conf.json configuration
console.log('\n✓ Checking tauri.conf.json...');
try {
  const configPath = path.join(__dirname, 'src-tauri/tauri.conf.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  
  if (config.bundle.icon) {
    console.log(`  [OK] Bundle icons configured: ${config.bundle.icon.length} icons`);
    checks.push(true);
  } else {
    console.log(`  [FAIL] Bundle icons NOT configured`);
    checks.push(false);
  }
} catch (e) {
  console.log(`  [FAIL] Error reading tauri.conf.json: ${e.message}`);
  checks.push(false);
}

// Final status
console.log('\n' + '='.repeat(50));
const passed = checks.filter(c => c).length;
const total = checks.length;
const percentage = Math.round((passed / total) * 100);

if (percentage === 100) {
  console.log(`\nSUCCESS: ALL CHECKS PASSED (${passed}/${total})`);
  console.log('\nYour app is ready to use the PitGames logo!');
  console.log('  - Run "npm run dev" to test');
  console.log('  - Run "npm run build" for production');
} else {
  console.log(`\nWARNING: CHECKS FAILED (${passed}/${total} - ${percentage}%)`);
  console.log('  Please review the errors above.');
}

console.log('\n');
