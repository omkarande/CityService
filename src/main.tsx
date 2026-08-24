import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { api } from './api/client';
import { initNativeShell } from './lib/native';
import './index.css';

void initNativeShell();

const root = document.getElementById('root')!;

void api
  .ready()
  .then(() => {
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </React.StrictMode>,
    );
  })
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    root.textContent = `Could not load CityService (${message}). The app needs the live API. Check internet, wait if Render is waking up, then reopen.`;
  });
