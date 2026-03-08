# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

A restaurant POS (Point of Sale) system built as a Progressive Web App (PWA). The UI is in Traditional Chinese (zh-TW). It runs entirely client-side with no backend server — all data is stored in the browser via IndexedDB.

## Commands

- `npm run dev` — Start Vite dev server with HMR
- `npm run build` — Type-check with `tsc -b` then build with Vite
- `npm run lint` — ESLint across the project
- `npm run preview` — Preview the production build locally

No test framework is configured.

## Tech Stack

- **React 19** + **TypeScript** (~5.9) + **Vite 7** (ESM-only, `"type": "module"`)
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin (imported as `@import "tailwindcss"` in globals.css)
- **Dexie.js** — IndexedDB wrapper for all persistent data (`src/db/database.ts`)
- **Zustand** — State management with `persist` middleware (stores save to localStorage)
- **react-router-dom v7** — Client-side routing with lazy-loaded pages
- **recharts** — Charts on the analytics page
- **date-fns** — Date formatting and intervals
- **react-hot-toast** — Toast notifications
- **vite-plugin-pwa** — Service worker + manifest for offline/PWA support

## Architecture

### Data Layer (`src/db/`)
- `types.ts` — All TypeScript interfaces for database entities (Category, Product, Order, Employee, etc.)
- `database.ts` — Dexie database class `PosDatabase` with 14 tables. The singleton `db` instance is imported throughout. `initializeDatabase()` auto-seeds on first load.
- `seed.ts` — Populates default categories, products, modifier groups, employees (admin PIN: 0000), and dining tables.

### State Stores (`src/stores/`)
- `useAuthStore` — Current employee session + shift ID (persisted as `pos-auth`)
- `useCartStore` — Cart items, table selection, order notes (persisted as `pos-cart`)
- `useUIStore` — Sidebar state, active modal, selected category (not persisted)

### Services (`src/services/`)
Business logic that operates on the Dexie database:
- `orderService` — Create orders, update status, cancel (restores inventory), generate order numbers (format: `YYYYMMDD-001`)
- `authService` — PIN verification via SHA-256 (Web Crypto API), role-based permissions, shift tracking
- `inventoryService` — Restock, adjust, waste tracking with full transaction history
- `analyticsService` — Revenue, order counts, top items, hourly breakdown, daily summaries
- `syncService` — Full data export/import (JSON), menu-only export/import, data reset

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

## Key Patterns

- Database IDs use Dexie auto-increment (`++id`). The `id` field on all types is `id?: number` (optional before insert).
- Cart items use `crypto.randomUUID()` for `cartItemId` to distinguish items with different modifiers.
- Order numbers follow `YYYYMMDD-NNN` format (date-fns `format`).
- PIN codes are hashed with SHA-256 via `crypto.subtle.digest` — never stored in plain text.
- TypeScript strict mode is enabled with `noUnusedLocals` and `noUnusedParameters`.
