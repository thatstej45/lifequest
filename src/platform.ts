import { Capacitor } from '@capacitor/core';

export const isNativeApp = Capacitor.isNativePlatform();

const matches = (query: string) => typeof window !== 'undefined' && window.matchMedia(query).matches;

export const isTouchDevice = () => matches('(hover: none)') || matches('(max-width: 900px)');

export const prefersReducedMotion = () => matches('(prefers-reduced-motion: reduce)');

/** Phones and WebViews cannot afford animated 90px blurs behind every scroll. */
export const wantsLightweightBackground = () => isNativeApp || isTouchDevice() || prefersReducedMotion();

export function applyPlatformFlags() {
  const root = document.documentElement;
  root.classList.toggle('is-native', isNativeApp);
  root.classList.toggle('is-touch', isTouchDevice());
}
