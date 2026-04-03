import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

/* ═══════════════════════════════════════════════════════════════════
   SESSION BOOTSTRAP
   ─────────────────────────────────────────────────────────────────
   The landing page (separate Vercel project) passes a base64-encoded
   session object as ?msp_auth=<token> after the user signs in/up.

   This file:
     1. Reads that token from the URL and writes it to localStorage
     2. Cleans the URL so the token isn't visible after mount
     3. If no valid session exists at all → redirect to the landing page
     4. Otherwise → mount the React <App />
═══════════════════════════════════════════════════════════════════ */

const LANDING_URL    = 'https://medschoolprep.vercel.app'; // ← your Repo 1 Vercel URL
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;          // 30 days

/* ── 1. Check for inbound msp_auth token from the landing page ── */
function ingestAuthToken() {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('msp_auth');
    if (!raw) return;

    const decoded = decodeURIComponent(raw);
    const session = JSON.parse(decodeURIComponent(escape(atob(decoded))));

    if (session?.email && session?.name && session?.at) {
      // Write session so App.jsx can read it from localStorage
      localStorage.setItem('msp_session', JSON.stringify(session));

      // Seed msp_user with name + email from session
      const existing = JSON.parse(localStorage.getItem('msp_user') || '{}');
      if (!existing.name) {
        existing.name       = session.name;
        existing.specialty  = existing.specialty  || null;
        existing.xp         = existing.xp         || 0;
        existing.streak     = existing.streak      || 0;
        existing.lastActive = existing.lastActive  || null;
        localStorage.setItem('msp_user', JSON.stringify(existing));
      }
    }

    // Remove the token from the URL — clean, professional UX
    params.delete('msp_auth');
    const cleanSearch = params.toString();
    const cleanURL = window.location.pathname + (cleanSearch ? '?' + cleanSearch : '');
    window.history.replaceState({}, document.title, cleanURL);

  } catch (err) {
    console.warn('msp_auth parse failed:', err.message);
    // Non-fatal — fall through to normal session check
  }
}

/* ── 2. Validate session from localStorage ── */
function getValidSession() {
  try {
    const raw = localStorage.getItem('msp_session');
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s?.email || !s?.name) return null;
    if (Date.now() - s.at > SESSION_TTL_MS) {
      localStorage.removeItem('msp_session');
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

/* ── 3. Run bootstrap ── */
ingestAuthToken();
const session = getValidSession();

if (!session) {
  // No valid session → send user back to landing page to sign in
  window.location.replace(LANDING_URL);
} else {
  // Personalise the document title while the app boots
  document.title = `MedSchoolPrep — ${session.name.split(' ')[0]}'s Workspace`;

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
