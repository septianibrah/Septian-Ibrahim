import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Suppress benign Vite/Sandpack WebSocket errors
if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = (...args) => {
    const msg = args[0] && typeof args[0] === 'string' ? args[0] : '';
    const isWSError = 
      msg.includes('failed to connect to websocket') || 
      msg.includes('WebSocket closed without opened') ||
      msg.includes('WebSocket connection to') ||
      (args[0] instanceof Error && /websocket/i.test(args[0].message)) ||
      (typeof args[0] === 'string' && /websocket/i.test(args[0]));

    if (isWSError) return;
    originalError.apply(console, args);
  };

  const originalWarn = console.warn;
  console.warn = (...args) => {
    const msg = args[0] && typeof args[0] === 'string' ? args[0] : '';
    if (msg.toLowerCase().includes('websocket')) return;
    originalWarn.apply(console, args);
  };

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    let msg = '';
    if (reason) {
      if (typeof reason === 'string') {
        msg = reason;
      } else if (typeof reason === 'object') {
        try {
          msg = reason.message || reason.description || String(reason);
        } catch (e) {
          msg = '';
        }
      }
    }
    
    const isWSError = 
      /websocket/i.test(msg) || 
      msg.includes('ws://') || 
      msg.includes('wss://') || 
      msg.includes('WebSocket closed');

    if (isWSError) {
      event.stopImmediatePropagation();
      event.preventDefault();
    }
  });

  window.addEventListener('error', (event) => {
     const msg = event.message || '';
     if (/websocket/i.test(msg) || msg.includes('ws://') || msg.includes('WebSocket closed')) {
       event.stopImmediatePropagation();
       event.preventDefault();
     }
  }, true);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
