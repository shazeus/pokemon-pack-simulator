<img width="2560" height="1280" alt="Yeni Proje" src="https://github.com/user-attachments/assets/0c61b486-a819-4533-8787-f2503436ff22" />
<p align="center">
  <h1 align="center">Pack Forge</h1>
  <p align="center">Animated Pokemon TCG pack opening simulator powered by the TCGdex API.</p>
  <p align="center">
    <a href="https://shazeus.github.io/pokemon-pack-simulator/"><img src="https://img.shields.io/badge/demo-live-2ac38b?style=flat-square" alt="Live Demo"></a>
    <a href="https://tcgdex.dev/"><img src="https://img.shields.io/badge/API-TCGdex-f4cf5c?style=flat-square" alt="TCGdex API"></a>
    <img src="https://img.shields.io/badge/React-19-61dafb?style=flat-square" alt="React">
    <img src="https://img.shields.io/badge/TypeScript-6-3178c6?style=flat-square" alt="TypeScript">
    <img src="https://img.shields.io/badge/Vite-8-646cff?style=flat-square" alt="Vite">
  </p>
</p>

---

Pack Forge turns live Pokemon TCG set data into a polished browser-based booster opening experience. Pick a set, choose a pack size, rip the pack, reveal cards one by one, and build a local binder with pull history and set completion stats.

The public GitHub Pages build is fully static. An optional login/register backend is included for people who download the source and want to self-host account features.

- **Live TCGdex data** — fetch sets, set details, card metadata, logos, symbols, and card images from TCGdex.
- **Animated pack opening** — booster rip, card draw, card flip, progress pips, and foil shine effects.
- **Pack generation logic** — common, uncommon, rare, and hit slots are generated from card rarity buckets.
- **Local binder** — store pulled cards, duplicates, hit history, and current-set completion in `localStorage`.
- **Multi-language sets** — switch between English, French, German, Spanish, Italian, and Brazilian Portuguese.
- **GitHub Pages ready** — static build works without a server, database, or secret environment variables.
- **Optional auth infrastructure** — Express API with register, login, JWT sessions, bcrypt password hashing, and file-backed storage.

## Demo

Live site:

```text
https://shazeus.github.io/pokemon-pack-simulator/
```

Repository:

```text
https://github.com/shazeus/pokemon-pack-simulator
```

## Installation

```bash
git clone https://github.com/shazeus/pokemon-pack-simulator.git
cd pokemon-pack-simulator
npm install
```

## Usage

Start the frontend:

```bash
npm run dev
```

Build the static site:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Features

| Feature | Description |
| --- | --- |
| Set picker | Search and switch between supported Pokemon TCG sets. |
| Pack sizes | Open 6, 10, or 12-card packs. |
| Reveal flow | Cards are revealed one at a time with animated transitions. |
| Rarity buckets | Pulls are generated from common, uncommon, rare, and hit pools. |
| Binder | Pulled cards are persisted locally with duplicate counts. |
| History | Recent packs show the best pulls from each opening. |
| Completion | Tracks unique cards collected from the selected set. |
| Static deploy | Works on GitHub Pages without a backend. |

## Optional Auth

Authentication is intentionally disabled in the GitHub Pages build. Static hosting cannot securely run login/register flows by itself.

To enable auth for a self-hosted copy:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
VITE_AUTH_ENABLED=true
VITE_AUTH_API_URL=http://localhost:8787/api

AUTH_ENABLED=true
PORT=8787
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=replace-with-at-least-32-random-characters
AUTH_DATA_FILE=.data/users.json
```

Run the frontend and auth API in separate terminals:

```bash
npm run dev
npm run dev:auth
```

Auth endpoints:

| Endpoint | Purpose |
| --- | --- |
| `POST /api/auth/register` | Create a user account. |
| `POST /api/auth/login` | Sign in and receive a JWT. |
| `GET /api/auth/me` | Read the current authenticated user. |

User records are stored in `.data/users.json` with bcrypt password hashes. The `.data` directory is ignored by git.

## TCGdex API

Pack Forge uses these public REST endpoints:

| Endpoint | Purpose |
| --- | --- |
| `GET /v2/{lang}/sets` | List available sets. |
| `GET /v2/{lang}/sets/{setId}` | Load one set and its card list. |
| `GET /v2/{lang}/cards/{cardId}` | Load card details such as rarity, type, variants, and pricing metadata. |

Card images use the TCGdex asset format:

```text
{image}/low.webp
{image}/high.webp
```

Documentation: [tcgdex.dev](https://tcgdex.dev/)

## Deployment

The project can be deployed as a static Vite app:

```bash
npm run build
```

The generated `dist/` directory is what GitHub Pages serves. The current live deployment is published from the `gh-pages` branch.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Type-check and build the static frontend. |
| `npm run preview` | Preview the production build locally. |
| `npm run lint` | Run ESLint. |
| `npm run dev:auth` | Start the optional self-hosted auth API. |
