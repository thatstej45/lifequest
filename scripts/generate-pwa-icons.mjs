import { Jimp } from 'jimp';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'public/icon_lightning.jpg');
const image = await Jimp.read(source);

for (const size of [64, 180, 192, 512]) {
  await image
    .clone()
    .resize({ w: size, h: size })
    .write(resolve(root, `public/icon-lightning-${size}.png`));
}

await image
  .clone()
  .resize({ w: 512, h: 512 })
  .write(resolve(root, 'public/icon_lightning.png'));
