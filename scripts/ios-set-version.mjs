import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const pbxPath = path.join(root, 'ios/App/App.xcodeproj/project.pbxproj');
const version = process.env.BUNDLE_VERSION ?? '1.0.0';
const build = String(process.env.IOS_BUILD_NUMBER ?? process.env.GITHUB_RUN_NUMBER ?? '1');

if (!/^\d+(\.\d+){0,2}$/.test(version)) {
  console.error(`BUNDLE_VERSION must look like 1.0.12, got ${version}`);
  process.exit(1);
}

let pbx = await readFile(pbxPath, 'utf8');
pbx = pbx.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`);
pbx = pbx.replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${build};`);
await writeFile(pbxPath, pbx);
console.log(`Set iOS MARKETING_VERSION=${version} CURRENT_PROJECT_VERSION=${build}`);
