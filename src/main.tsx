import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App.tsx';
import './index.css';
import { applyTheme, getStoredTheme } from './theme';
import { initLiveUpdates } from './liveUpdate';

applyTheme(getStoredTheme());
void initLiveUpdates();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000;
  // A first-ever registration claims this page without its code being outdated,
  // so only a controller swap means the running bundle is stale.
  const wasControlled = Boolean(navigator.serviceWorker.controller);
  let reloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!wasControlled || reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(registration => {
      let lastCheck = Date.now();
      const checkForUpdate = () => {
        lastCheck = Date.now();
        void registration.update();
      };

      window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        if (Date.now() - lastCheck < 5 * 60 * 1000) return;
        checkForUpdate();
      });
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}
