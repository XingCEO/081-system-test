# Deployment

This project is set up to run as a single production service:

- React build output is served by the Express server
- API routes are exposed under `/api`
- SQLite is persisted by setting `DB_PATH`

## Local production run

```bash
npm run build
npm start
```

The server listens on `PORT` when provided, otherwise `3001`.

## Docker

```bash
docker build -t pos-system .
docker run -p 10000:10000 -e PORT=10000 -e DB_PATH=/app/data/pos.db pos-system
```

Mount a volume to `/app/data` if you want SQLite data to survive container replacement.

## Render

Use the root-level `render.yaml`.

Important values:

- Health check path: `/api/health`
- Persistent disk mount path: `/app/data`
- SQLite path: `DB_PATH=/app/data/pos.db`

Do not deploy this app to Vercel if you need persistent SQLite data.
