import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const version = process.env.BUNDLE_VERSION ?? 'dev';
const swPath = path.join(root, 'public', 'sw.js');

const source = await readFile(swPath, 'utf8');
const marker = /\/\* Service Worker Version: .* \*\/\nconst VERSION = '[^']*';/;
if (!marker.test(source)) {
  console.error('Could not find public/sw.js version marker');
  process.exit(1);
}

const next = source.replace(
  marker,
  `/* Service Worker Version: ${version} */\nconst VERSION = '${version}';`,
);

if (next !== source) {
  await writeFile(swPath, next);
}

console.log(`Synced service worker version to ${version}`);
