import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const distDir = path.join(root, 'dist');
const outDir = path.join(root, 'mobile-release');
const zipPath = path.join(outDir, 'dist.zip');
const version = process.env.BUNDLE_VERSION;
const publicBase = process.env.OTA_PUBLIC_BASE ?? 'https://thatstej45.github.io/lifequest';

if (!version) {
  console.error('BUNDLE_VERSION is required, e.g. 1.0.12');
  process.exit(1);
}

await mkdir(outDir, { recursive: true });
await rm(zipPath, { force: true });

const zip = spawnSync('zip', ['-r', zipPath, '.'], {
  cwd: distDir,
  stdio: 'inherit',
});
if (zip.status !== 0) {
  process.exit(zip.status ?? 1);
}

const zipBytes = await readFile(zipPath);
const checksum = createHash('sha256').update(zipBytes).digest('hex');

const manifest = {
  version,
  url: `${publicBase.replace(/\/$/, '')}/dist.zip`,
  checksum,
};

await writeFile(path.join(outDir, 'update.json'), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(
  path.join(outDir, 'index.html'),
  `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>LifeQuest updates</title>
  </head>
  <body>
    <p>LifeQuest OTA channel ${version}. Sideload the APK, then later git pushes update the installed app automatically.</p>
  </body>
</html>
`,
);

console.log(`Packaged OTA bundle ${version} (${checksum})`);
