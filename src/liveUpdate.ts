import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import type { PluginListenerHandle } from '@capacitor/core';
import { APP_VERSION } from './version';

const UPDATE_MANIFEST_URL = 'https://raw.githubusercontent.com/thatstej45/lifequest/gh-pages/update.json';
const WEB_UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const WEB_UPDATE_MIN_GAP_MS = 5 * 60 * 1000;

interface UpdateManifest {
  version: string;
  url: string;
  checksum?: string;
}

export type UpdatePhase = 'idle' | 'checking' | 'downloading' | 'applying' | 'ready' | 'error';

export interface AppUpdateState {
  phase: UpdatePhase;
  runningVersion: string;
  channelVersion: string | null;
  message: string;
  progress: number | null;
  busy: boolean;
}

type ApplyMode = 'immediate' | 'background';

const listeners = new Set<(state: AppUpdateState) => void>();

let state: AppUpdateState = {
  phase: 'idle',
  runningVersion: APP_VERSION,
  channelVersion: null,
  message: '',
  progress: null,
  busy: false,
};

let inFlight: Promise<void> | null = null;
let downloadListener: PluginListenerHandle | null = null;
let coldStart = true;
let webLastCheck = 0;
let webReloading = false;

function emit() {
  listeners.forEach(listener => listener(state));
}

function setState(patch: Partial<AppUpdateState>) {
  state = { ...state, ...patch };
  emit();
}

function parseSemver(value: string): number[] | null {
  const match = value.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function isNewerVersion(remote: string, current: string): boolean {
  if (!current || current === 'builtin' || current === 'dev') return true;
  const next = parseSemver(remote);
  const prev = parseSemver(current);
  if (!next || !prev) return remote !== current;
  for (let i = 0; i < 3; i += 1) {
    if (next[i] > prev[i]) return true;
    if (next[i] < prev[i]) return false;
  }
  return false;
}

function formatVersionLabel(version: string): string {
  return version.startsWith('v') ? version : `v${version}`;
}

async function fetchManifest(): Promise<UpdateManifest> {
  const response = await fetch(UPDATE_MANIFEST_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Update channel unreachable (HTTP ${response.status})`);
  }
  const manifest = (await response.json()) as UpdateManifest;
  if (!manifest.version || !manifest.url) {
    throw new Error('Update channel returned an invalid manifest');
  }
  return manifest;
}

export async function getRunningVersion(): Promise<string> {
  if (!Capacitor.isNativePlatform()) return APP_VERSION;
  try {
    const current = await CapacitorUpdater.current();
    const version = current.bundle.version;
    if (!version || version === 'builtin') return APP_VERSION;
    return version;
  } catch (error) {
    console.warn('Could not read native bundle version', error);
    return APP_VERSION;
  }
}

async function ensureDownloadListener(onProgress: (percent: number) => void) {
  if (downloadListener) return;
  downloadListener = await CapacitorUpdater.addListener('download', event => {
    onProgress(event.percent);
  });
}

async function clearDownloadListener() {
  if (!downloadListener) return;
  await downloadListener.remove();
  downloadListener = null;
}

async function applyNativeUpdate(manifest: UpdateManifest, mode: ApplyMode): Promise<'updated' | 'current'> {
  const runningVersion = await getRunningVersion();
  if (!isNewerVersion(manifest.version, runningVersion)) {
    return 'current';
  }

  setState({
    phase: 'downloading',
    message: `Downloading ${formatVersionLabel(manifest.version)}…`,
    progress: 0,
    channelVersion: manifest.version,
  });

  await ensureDownloadListener(percent => {
    setState({ progress: percent, message: `Downloading ${formatVersionLabel(manifest.version)}… ${Math.round(percent)}%` });
  });

  let bundle;
  try {
    bundle = await CapacitorUpdater.download({
      url: manifest.url,
      version: manifest.version,
      checksum: manifest.checksum,
    });
  } finally {
    await clearDownloadListener();
  }

  setState({
    phase: 'applying',
    message: mode === 'immediate' ? 'Applying update…' : 'Scheduling update for background…',
    progress: 100,
  });

  if (mode === 'immediate') {
    await CapacitorUpdater.set({ id: bundle.id });
    return 'updated';
  }

  await CapacitorUpdater.next({ id: bundle.id });
  setState({
    phase: 'ready',
    message: `Update ${formatVersionLabel(manifest.version)} ready — applies on next background`,
    progress: null,
    busy: false,
  });
  return 'updated';
}

async function runNativeUpdate(mode: ApplyMode, manual: boolean): Promise<void> {
  setState({
    busy: true,
    phase: 'checking',
    message: 'Checking update channel…',
    progress: null,
  });

  try {
    const manifest = await fetchManifest();
    setState({ channelVersion: manifest.version });

    const result = await applyNativeUpdate(manifest, mode);
    const runningVersion = await getRunningVersion();

    if (result === 'current') {
      setState({
        phase: 'ready',
        runningVersion,
        message: manual ? 'Up to date' : '',
        progress: null,
        busy: false,
      });
      return;
    }

    if (mode === 'immediate') {
      setState({
        message: `Updated to ${formatVersionLabel(manifest.version)}`,
        runningVersion: manifest.version,
      });
      return;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Update check failed';
    console.warn('Native update failed', error);
    setState({
      phase: 'error',
      message,
      progress: null,
      busy: false,
    });
    throw error;
  }
}

async function refreshWebApp(manual: boolean): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    if (manual) {
      window.location.reload();
    }
    return;
  }

  setState({
    busy: true,
    phase: 'checking',
    message: 'Checking for web update…',
    progress: null,
  });

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      throw new Error('Service worker is not registered');
    }

    const updatePromise = new Promise<void>(resolve => {
      const onUpdateFound = () => {
        const worker = registration.installing;
        if (!worker) {
          resolve();
          return;
        }
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed') resolve();
        });
      };
      registration.addEventListener('updatefound', onUpdateFound, { once: true });
      window.setTimeout(resolve, 2500);
    });

    await registration.update();
    await updatePromise;

    const waiting = registration.waiting;
    if (waiting) {
      setState({ phase: 'downloading', message: 'Downloading update…', progress: null });
      waiting.postMessage({ type: 'SKIP_WAITING' });
      setState({ phase: 'applying', message: 'Applying update…', progress: null });
      webReloading = true;
      window.location.reload();
      return;
    }

    setState({
      phase: 'ready',
      message: manual ? 'Up to date' : '',
      progress: null,
      busy: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Web update failed';
    console.warn('Web update failed', error);
    setState({
      phase: 'error',
      message,
      progress: null,
      busy: false,
    });
    throw error;
  }
}

async function runAutomaticNativeUpdate() {
  const mode: ApplyMode = coldStart ? 'immediate' : 'background';
  coldStart = false;
  try {
    await runNativeUpdate(mode, false);
  } catch {
    // Automatic checks stay silent except for surfaced state.message on error.
  }
}

async function runAutomaticWebUpdate() {
  const now = Date.now();
  if (now - webLastCheck < WEB_UPDATE_MIN_GAP_MS) return;
  webLastCheck = now;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return;
    await registration.update();
  } catch (error) {
    console.warn('Automatic web update check failed', error);
  }
}

export function subscribeAppUpdate(listener: (next: AppUpdateState) => void): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export function getAppUpdateState(): AppUpdateState {
  return state;
}

export async function refreshApp(): Promise<void> {
  if (inFlight) {
    await inFlight;
    return;
  }

  inFlight = (async () => {
    const runningVersion = await getRunningVersion();
    setState({ runningVersion });

    if (Capacitor.isNativePlatform()) {
      await runNativeUpdate('immediate', true);
      return;
    }
    await refreshWebApp(true);
  })().finally(() => {
    inFlight = null;
  });

  await inFlight;
}

async function refreshRunningVersion() {
  const runningVersion = await getRunningVersion();
  setState({ runningVersion });
}

export async function initLiveUpdates() {
  await refreshRunningVersion();

  if (Capacitor.isNativePlatform()) {
    await CapacitorUpdater.notifyAppReady();
    void runAutomaticNativeUpdate();

    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void runAutomaticNativeUpdate();
    });
    return;
  }

  if (!('serviceWorker' in navigator)) return;

  const wasControlled = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!wasControlled || webReloading) return;
    webReloading = true;
    window.location.reload();
  });

  // Resolved against the document so the same bundle works from a GitHub Pages
  // subpath (/lifequest/) and from the site root.
  const swUrl = new URL(`${import.meta.env.BASE_URL}sw.js`, document.baseURI).href;
  const swScope = new URL(import.meta.env.BASE_URL, document.baseURI).href;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(swUrl, { scope: swScope, updateViaCache: 'none' }).then(registration => {
      void runAutomaticWebUpdate();
      window.setInterval(() => void runAutomaticWebUpdate(), WEB_UPDATE_CHECK_INTERVAL_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void runAutomaticWebUpdate();
      });
    }).catch(error => {
      console.warn('Service worker registration failed', error);
    });
  });
}

export { UPDATE_MANIFEST_URL, formatVersionLabel };
