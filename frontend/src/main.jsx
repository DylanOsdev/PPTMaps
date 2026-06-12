import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Suppress THREE.Clock deprecation warning from @react-three/fiber internals
// R3F uses Clock internally but Three.js r183+ deprecated it for Timer.
// R3F Timer migration is pending upstream — see https://github.com/pmndrs/react-three-fiber/issues
const originalWarn = console.warn;
console.warn = (...args) => {
  const msg = typeof args[0] === 'string' ? args[0] : '';
  if (msg.includes('THREE.Clock') && msg.includes('deprecated')) return;
  originalWarn(...args);
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// PWA: registra el service worker solo en producción (en dev interfiere con HMR).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
