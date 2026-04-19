import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { getLocalHomeRoute, LocalHomeGalleryApp } from './localHomeGallery';
import './styles.css';
import './local-home-gallery.css';

const localHomeRoute = typeof window !== 'undefined'
  ? getLocalHomeRoute(window.location.pathname, window.location.hostname)
  : null;

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {localHomeRoute ? <LocalHomeGalleryApp route={localHomeRoute} /> : <App />}
  </React.StrictMode>,
);
