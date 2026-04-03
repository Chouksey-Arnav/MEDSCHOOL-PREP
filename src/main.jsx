// src/main.jsx
// BUG FIX: This file previously contained CSS (identical to index.css).
// Vite's entry point MUST be a JSX/JS file that mounts the React app.
// Without this, the entire app fails to render.

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
