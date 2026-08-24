import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { applyTheme, getStoredTheme } from './theme';
import { initLiveUpdates } from './liveUpdate';
import { applyPlatformFlags } from './platform';

applyTheme(getStoredTheme());
applyPlatformFlags();
void initLiveUpdates();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
