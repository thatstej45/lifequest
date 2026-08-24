import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const version = process.env.BUNDLE_VERSION ?? 'dev';
const swPath = path.join(root, 'public', 'sw.js');

const source = await readFile(swPath, 'utf8');
const next = source.replace(
  /\/\* Service Worker Version: .* \*\/\nconst VERSION = '[^']*';/,
  `/* Service Worker Version: ${version} */\nconst VERSION = '${version}';`,
);

if (next === source) {
  console.error('Could not patch public/sw.js version marker');
  process.exit(1);
}

await writeFile(swPath, next);
console.log(`Synced service worker version to ${version}`);
