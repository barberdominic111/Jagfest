# Forbes Jags

A Pac-Man-inspired dorm party game, built as an installable PWA (works on
Android, iPhone, desktop, and tablets).

## Play it locally

```bash
npm install
npm run dev
```

Then open the URL it prints (usually `http://localhost:5173`).

## Project structure

- `src/App.jsx` — the entire game (map, engine, HUD, setup screen, UI).
  This is intentionally one file for now; see the comment at the top of
  the file for how to split it into `map.js`, `engine.js`, `Hud.jsx`,
  etc. as it grows.
- `src/main.jsx` — mounts the app and registers the service worker.
- `public/manifest.webmanifest` — PWA manifest (name, icons, colors).
- `public/sw.js` — a minimal offline cache.
- `public/icons/` — app icons (an original pixel-art illustration
  inspired by Pitt's Cathedral of Learning).

## Deploying

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Forbes Jags"
git branch -M main
git remote add origin https://github.com/<your-username>/forbes-jags.git
git push -u origin main
```

### 2. Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import the GitHub
   repo you just pushed.
2. Vercel auto-detects Vite — no config changes needed. Framework
   Preset: **Vite**, Build Command: `npm run build`, Output Directory:
   `dist`.
3. Click **Deploy**. You'll get a URL like `forbes-jags.vercel.app`.

### 3. Install it as an app

Open the Vercel URL on a phone:

- **iPhone (Safari)**: tap Share → "Add to Home Screen."
- **Android (Chrome)**: tap the menu (⋮) → "Install app" (or you'll see
  an automatic install prompt).
- **Desktop (Chrome/Edge)**: click the install icon in the address bar.

## Notes for next steps

- The win target (10/15/20 items) and sprite choices are all made on
  the in-game setup screen — nothing to configure in code.
- If you want a custom domain, add it under the Vercel project's
  **Settings → Domains** tab.
- To ship an update, just push to `main` — Vercel redeploys
  automatically. Bump `CACHE_NAME` in `public/sw.js` when you do, so
  installed users get the new version instead of a cached old one.
