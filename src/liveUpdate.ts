import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

const UPDATE_MANIFEST_URL = 'https://thatstej45.github.io/lifequest/update.json';

interface UpdateManifest {
  version: string;
  url: string;
  checksum?: string;
}

function parseSemver(value: string): number[] | null {
  const match = value.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isNewerVersion(remote: string, current: string): boolean {
  if (!current || current === 'builtin') return true;
  const next = parseSemver(remote);
  const prev = parseSemver(current);
  if (!next || !prev) return remote !== current;
  for (let i = 0; i < 3; i += 1) {
    if (next[i] > prev[i]) return true;
    if (next[i] < prev[i]) return false;
  }
  return false;
}

let checking = false;

async function applyPublishedUpdate() {
  if (checking) return;
  checking = true;
  try {
    const response = await fetch(UPDATE_MANIFEST_URL, { cache: 'no-store' });
    if (!response.ok) return;
    const manifest = (await response.json()) as UpdateManifest;
    if (!manifest.version || !manifest.url) return;

    const current = await CapacitorUpdater.current();
    const currentVersion = current.bundle.version;
    if (!isNewerVersion(manifest.version, currentVersion)) return;

    const bundle = await CapacitorUpdater.download({
      url: manifest.url,
      version: manifest.version,
    });
    await CapacitorUpdater.set(bundle);
  } catch (error) {
    console.warn('Live update check failed', error);
  } finally {
    checking = false;
  }
}

export async function initLiveUpdates() {
  if (!Capacitor.isNativePlatform()) return;

  await CapacitorUpdater.notifyAppReady();
  await applyPublishedUpdate();

  App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) void applyPublishedUpdate();
  });
}
