# POS System

Restaurant POS system built with:

- React 19 + TypeScript + Vite
- Express 5 API
- SQLite via `better-sqlite3`
- Dexie for client-side reactive cache

## Development

```bash
npm install
npm --prefix server install
npm run dev
```

This starts:

- Vite client on `http://localhost:5173`
- Express API on `http://localhost:3001`

## Production

```bash
npm run build
npm start
```

In production, the Express server serves both:

- frontend static files from `dist`
- backend API routes from `/api`

SQLite data is stored at:

- `server/data/pos.db` by default
- `DB_PATH` when the environment variable is provided

## Deployment

See [DEPLOY.md](./DEPLOY.md).

The repository includes:

- `Dockerfile` for a single-container deploy
- `render.yaml` for Render with a persistent disk
