import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@homecook/app/App';
import '@homecook/styles/global.css';

const root = document.getElementById('root');
if (root) createRoot(root).render(<StrictMode><App /></StrictMode>);

// Offline support. Registration failing (private mode, http, unsupported) is
// not an error worth showing anyone — the app works without it.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
