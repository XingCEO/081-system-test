# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A restaurant POS (Point of Sale) system with a React PWA frontend and an Express/SQLite backend. The UI is in Traditional Chinese (zh-TW). The frontend uses Dexie (IndexedDB) as a local cache synced from the server — the server's SQLite database is the source of truth.

## Commands

- `npm run dev` — Start both Vite dev server and backend concurrently
- `npm run dev:client` — Start Vite dev server only
- `npm run dev:server` — Start Express backend only (uses `tsx watch` for hot reload)
- `npm run build` — Build both client (`tsc -b && vite build`) and server (`server/` TypeScript compile)
- `npm run build:client` — Build frontend only
- `npm run build:server` — Build backend only
- `npm start` — Run production server (`node server/dist/index.js`)
- `npm run lint` — ESLint across the project
- `npm run preview` — Preview the production build locally
- `npm test` — Run all Vitest tests (`vitest run`)
- `npx vitest run src/services/orderService.test.ts` — Run a single test file

**Setup:** Run `npm install` in both the root directory and `server/` — they have separate `package.json` files.

## Tech Stack

### Frontend
- **React 19** + **TypeScript** (~5.9) + **Vite 7** (ESM-only, `"type": "module"`)
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin (imported as `@import "tailwindcss"` in globals.css)
- **Dexie.js** — IndexedDB wrapper used as local cache (`src/db/database.ts`)
- **Zustand** — State management with `persist` middleware (stores save to localStorage)
- **react-router-dom v7** — Client-side routing with lazy-loaded pages
- **Vitest** + **@testing-library/react** — Unit/integration tests (jsdom environment, setup in `src/test/setup.ts`)
- **recharts** — Charts on the analytics page
- **date-fns** — Date formatting and intervals
- **react-hot-toast** — Toast notifications
- **vite-plugin-pwa** — Service worker + manifest for offline/PWA support

### Backend (`server/`)
- **Express 5** + **TypeScript** — REST API on port 3001 (dev), 8080 (production)
- **better-sqlite3** — SQLite database stored at `server/data/pos.db` (or `./data/pos.db` in production)
- Vite dev server proxies `/api/*` to the backend
- In production, the Express server serves the static frontend from `dist/`

## Architecture

### Data Flow
The system uses a **server-authoritative sync model**:
1. All mutations (create order, update product, etc.) go through REST API calls to the Express server
2. The server writes to SQLite and returns results
3. A sync manager (`src/api/sync.ts`) polls `GET /api/sync/export` every 5 seconds and writes all server data into local Dexie tables
4. React components use `useLiveQuery()` from Dexie to reactively render — so the UI stays reactive while the server remains the source of truth
5. If the server is unavailable, the app falls back to local Dexie data

### API Layer (`src/api/`)
- `client.ts` — Thin fetch wrapper (`api.get/post/put/del`) that calls `/api/*` endpoints
- `sync.ts` — `startSync()`/`stopSync()` manages periodic full-state pull from server to Dexie

### Backend (`server/src/`)
- `index.ts` — Express app with all REST endpoints for every entity (categories, products, orders, employees, etc.)
- `db.ts` — SQLite schema, connection, and JSON column helpers (`rowToJs`/`jsToRow`)
- `seed.ts` — Seeds default data on first run (admin PIN: 0000)

### Data Layer (`src/db/`)
- `types.ts` — All TypeScript interfaces for database entities (shared between client logic and API responses)
- `database.ts` — Dexie database class `PosDatabase` with 14 tables. The singleton `db` instance is imported throughout.
- `seed.ts` / `seedBom.ts` — Client-side seed data (used as fallback when server is unavailable)

### State Stores (`src/stores/`)
- `useAuthStore` — Current employee session + shift ID (persisted as `pos-auth`)
- `useCartStore` — Cart items, table selection, order notes (persisted as `pos-cart`)
- `useUIStore` — Sidebar state, active modal, selected category (not persisted)
- `useThemeStore` — Dark/light mode preference
- `useAppSettingsStore` — Application-level settings

### Services (`src/services/`)
Business logic that operates on the Dexie database (local cache):
- `orderService` — Create orders, update status, cancel (restores inventory), generate order numbers (format: `YYYYMMDD-001`)
- `authService` — PIN verification via SHA-256, role-based permissions, shift tracking
- `inventoryService` — Restock, adjust, waste tracking with full transaction history
- `analyticsService` — Revenue, order counts, top items, hourly breakdown, daily summaries
- `syncService` — Full data export/import (JSON), menu-only export/import, data reset
- `bomService` — Bill of Materials management for ingredient-level inventory
- `settingsService` — App configuration persistence
- `modifierGroupService` — CRUD for custom modifier groups (add-ons, options)

### Routing & Layout
- `App.tsx` — BrowserRouter with all routes. All page components are `lazy()` loaded.
- `AppShell` (`src/components/layout/`) — Wraps authenticated routes; redirects to `/login` if not authenticated. Contains Header + Sidebar + `<Outlet />`.
- Role-based access: `admin` sees all pages, `cashier` sees POS/tables/orders, `kitchen` sees kitchen display only.

### Pages (`src/pages/`)
Each page is a directory with `index.tsx` (default export). The POS page also has `CartPanel`, `MenuGrid`, `CheckoutModal`, and `ModifierModal` sub-components.

Routes: `/login`, `/pos`, `/tables`, `/kitchen`, `/orders`, `/menu-management`, `/inventory`, `/employees`, `/analytics`, `/settings`

### Styling
- Tailwind v4 with custom component classes defined in `src/styles/globals.css`: `btn-primary`, `btn-secondary`, `btn-danger`, `btn-success`, `btn-warning`, `card`, `input-field`, `sidebar-link`, `number-pad-btn`, `table-available/occupied/cleaning/reserved`
- Print styles for 80mm thermal receipt printing via `@media print` and `.receipt-print` class
- Touch-optimized: `touch-action: manipulation`, `user-scalable=no`, `select-none` on buttons

### Localization (`src/i18n/zh-TW.ts`)
All UI strings are centralized in a single object. The type `I18n` is exported for type-safe access.

## Deployment

- **Dockerfile** — Multi-stage build: builds both client and server, runs `node server/dist/index.js` on port 8080
- **render.yaml** / **zeabur.json** — Platform deployment configs
- Production server serves static frontend from `dist/` and API from `/api/*`

## Key Patterns

- Database IDs use auto-increment (`++id` in Dexie, `INTEGER PRIMARY KEY AUTOINCREMENT` in SQLite). The `id` field on all types is `id?: number` (optional before insert).
- Cart items use `crypto.randomUUID()` for `cartItemId` to distinguish items with different modifiers.
- Order numbers follow `YYYYMMDD-NNN` format (date-fns `format`).
- PIN codes are hashed with SHA-256 — never stored in plain text. Server uses Node `crypto`, client uses Web Crypto API.
- TypeScript strict mode is enabled with `noUnusedLocals` and `noUnusedParameters`.
- SQLite stores arrays/objects as JSON strings; `rowToJs`/`jsToRow` in `server/src/db.ts` handle serialization.
- Tests use `fake-indexeddb/auto` to mock IndexedDB. The test setup (`src/test/setup.ts`) deletes and reopens the Dexie database before/after each test for isolation.
