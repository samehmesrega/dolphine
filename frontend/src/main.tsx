import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// #region agent log
window.addEventListener('error', (event) => {
  fetch('http://127.0.0.1:7242/ingest/1424ae04-f79a-48c9-a6b0-4702d1f6cf84', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      runId: 'initial',
      hypothesisId: 'H2',
      location: 'frontend/src/main.tsx:windowError',
      message: 'Uncaught error',
      data: {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    }),
  }).catch(() => {});
});

window.addEventListener('unhandledrejection', (event) => {
  fetch('http://127.0.0.1:7242/ingest/1424ae04-f79a-48c9-a6b0-4702d1f6cf84', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      runId: 'initial',
      hypothesisId: 'H3',
      location: 'frontend/src/main.tsx:unhandledRejection',
      message: 'Unhandled promise rejection',
      data: {
        reason: (event.reason && event.reason.message) || String(event.reason),
      },
    }),
  }).catch(() => {});
});
// #endregion

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
