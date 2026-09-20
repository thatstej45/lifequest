import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'android/app/src/main/res/raw/lifequest_reminder.wav');

const sampleRate = 44_100;
const durationSeconds = 0.36;
const sampleCount = Math.floor(sampleRate * durationSeconds);
const dataSize = sampleCount * 2;
const wav = Buffer.alloc(44 + dataSize);

wav.write('RIFF', 0);
wav.writeUInt32LE(36 + dataSize, 4);
wav.write('WAVE', 8);
wav.write('fmt ', 12);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(sampleRate, 24);
wav.writeUInt32LE(sampleRate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(dataSize, 40);

for (let index = 0; index < sampleCount; index += 1) {
  const time = index / sampleRate;
  const progress = index / sampleCount;
  const envelope = Math.sin(Math.PI * progress) ** 2;
  const chime = (
    Math.sin(2 * Math.PI * 880 * time)
    + 0.45 * Math.sin(2 * Math.PI * 1320 * time)
  ) / 1.45;
  wav.writeInt16LE(Math.round(chime * envelope * 18_000), 44 + index * 2);
}

await mkdir(dirname(output), { recursive: true });
await writeFile(output, wav);
