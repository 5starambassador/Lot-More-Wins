// Copies the Partner App release APK into public/ so the download page can serve it.
import { copyFileSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, '../partner-app/android/app/build/outputs/apk/release/app-release.apk');
const target = resolve(root, 'public/lot-more-wins-partner.apk');

if (!existsSync(source)) {
  console.error(`No release APK at ${source}. Build the Partner App first.`);
  process.exit(1);
}

copyFileSync(source, target);
console.log(`Copied ${(statSync(target).size / 1024 / 1024).toFixed(1)} MB to ${target}`);
