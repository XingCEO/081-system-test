# PROJECT KNOWLEDGE BASE

**Updated:** 2026-04-03

## OVERVIEW

Restaurant POS (Point of Sale) system — React 19 PWA frontend + Express 5 / SQLite backend. UI in Traditional Chinese (zh-TW). Server-authoritative sync model: mutations go to REST API → SQLite, then periodic sync pulls all state into client-side Dexie (IndexedDB). Falls back to local Dexie when server unavailable.

## STRUCTURE

```
.
├── src/
│   ├── api/           # Fetch wrapper + sync polling (client.ts, sync.ts)
│   ├── components/
│   │   ├── layout/    # AppShell (auth guard), Header, Sidebar
│   │   └── ui/        # Modal, ConfirmDialog, NumberPad, Icons, UserAvatar
│   ├── db/            # Dexie schema (17 tables), types, seed data
│   ├── hooks/         # useOnlineStatus only
│   ├── i18n/          # zh-TW.ts — single file, all UI strings
│   ├── pages/         # Directory-per-page with index.tsx (lazy-loaded)
│   ├── services/      # Business logic layer (see src/services/AGENTS.md)
│   ├── stores/        # Zustand stores (5): auth, cart, UI, theme, appSettings
│   ├── styles/        # globals.css — Tailwind v4 + custom components + themes
│   ├── test/          # Vitest setup with fake-indexeddb
│   └── utils/         # currency, date, orderNumber, inventory, constants
├── server/            # Express 5 + better-sqlite3 (separate package.json)
│   └── src/           # index.ts (all endpoints), db.ts (schema), seed.ts
├── vite.config.ts     # React + Tailwind v4 + PWA plugins, /api proxy to :3001
└── package.json       # ESM ("type": "module"), concurrent dev scripts
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add new page | `src/pages/NewPage/index.tsx` + lazy route in `App.tsx` | Follow directory-per-page pattern |
| Add DB table | `src/db/database.ts` (new version), `src/db/types.ts` | Bump schema version for migration |
| Add service | `src/services/` | Follow API-first-fallback pattern (see services/AGENTS.md) |
| Modify auth/roles | `src/services/authService.ts` | `hasPermission()` + `ROUTE_PERMISSIONS` map |
| Add UI strings | `src/i18n/zh-TW.ts` | Type `I18n` enforces completeness |
| Add shared component | `src/components/ui/` | Keep page-specific components in their page dir |
| Add Zustand store | `src/stores/useXxxStore.ts` | Use `persist` middleware for localStorage |
| Modify API endpoint | `server/src/index.ts` | All routes in one file |
| Change DB schema (server) | `server/src/db.ts` | JSON columns via `rowToJs`/`jsToRow` |
| Styling | `src/styles/globals.css` | Custom component classes + CSS variable theming |
| Tests | Co-located `*.test.ts` next to source | `npm test` runs Vitest |

## COMMANDS

```bash
npm install && npm --prefix server install   # Setup (two package.json files)
npm run dev            # Vite (:5173) + Express (:3001) concurrently
npm run dev:client     # Vite only
npm run dev:server     # Express only (tsx watch)
npm run build          # tsc -b && vite build + server build
npm start              # Production: node server/dist/index.js (serves static + API)
npm run lint           # ESLint (flat config)
npm test               # Vitest run
npx vitest run src/services/orderService.test.ts  # Single test file
```

## DATA FLOW

```
User action → API call (src/api/client.ts) → Express endpoint → SQLite write
                                                                    ↓
UI ← useLiveQuery(Dexie) ← Sync manager (src/api/sync.ts) polls /api/sync/export every 5s
                             ↓ (fallback if server down)
                          Local Dexie operations directly
```

## CONVENTIONS

- **Strict TypeScript**: `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `erasableSyntaxOnly`
- **No path aliases**: All imports use relative paths
- **DB IDs**: Auto-increment (`++id` Dexie, `AUTOINCREMENT` SQLite). `id?: number` (optional before insert)
- **Order numbers**: `YYYYMMDD-NNN` format via date-fns
- **PIN security**: SHA-256 hashed — server uses Node `crypto`, client uses Web Crypto API
- **Cart IDs**: `crypto.randomUUID()` for `cartItemId` (distinguishes items with different modifiers)
- **Pages**: Directory with `index.tsx` default export, lazy-loaded in App.tsx. Sub-components co-located in same dir.
- **Components**: Shared in `components/ui/`, page-specific in their page dir. No HOCs, no render props — functional with hooks.
- **State**: Zustand stores consumed directly (no Context, no prop drilling beyond callbacks). Persisted stores: auth (`pos-auth`), cart (`pos-cart`).
- **Dexie reactivity**: Components use `useLiveQuery()` from `dexie-react-hooks` for reactive DB queries.
- **Service pattern**: API-first with Dexie fallback (see `src/services/AGENTS.md`).
- **Tailwind v4**: `@tailwindcss/vite` plugin, no separate config file. Custom classes in `globals.css`.
- **Theming**: CSS variables (`--theme-primary`, `--surface-*`) + `@custom-variant dark`. `settingsService.applyThemeColor()` sets runtime theme.

## ANTI-PATTERNS (THIS PROJECT)

- `eslint-disable react-refresh/only-export-components` in `Icons.tsx` — justified (icon library exports many named components)
- No other suppressions in src/. Zero `as any`, `@ts-ignore`, `@ts-expect-error` in project code.
- `LoginPage.tsx` is a flat file in `src/pages/` instead of a directory — inconsistent but intentional (simple page).

## DATABASE (17 TABLES)

Schema v4 (Dexie). SQLite mirrors the same structure.

**Core**: categories, products, modifierGroups, modifiers, diningTables
**BOM**: ingredients, productRecipes, modifierRecipes, inventory, inventoryTransactions
**Operations**: orders, orderItems, employees, shifts, dailySummaries
**System**: settings, syncQueue

Key relationships: products→categories, orderItems→orders/products, productRecipes→products/ingredients, modifiers→modifierGroups, inventory→ingredients, shifts→employees.

Compound indexes: `[categoryId+isActive]`, `[status+createdAt]`, `[orderId+productId]`, `[employeeId+startTime]`, `[ingredientId+createdAt]`, `[productId+ingredientId]`.

## ROUTING & AUTH

10 routes: `/login`, `/pos`, `/tables`, `/kitchen`, `/orders`, `/menu-management`, `/inventory`, `/employees`, `/analytics`, `/settings`

Role permissions (AppShell enforces via `startsWith` matching):
- **admin**: All routes
- **cashier**: `/pos`, `/tables`, `/orders`
- **kitchen**: `/kitchen` only

Auto-logout timer based on inactivity (configurable in AppSettingsStore).

## DEPLOYMENT

- **Dockerfile**: Multi-stage build, runs on port 8080. Serves static + API.
- **render.yaml**: Render with persistent disk for SQLite.
- **zeabur.json**: Zeabur platform config.
- SQLite path: `server/data/pos.db` (dev) or `DB_PATH` env var.

## NOTES

- PWA manifest is inline in `vite.config.ts` (no separate manifest.json). `registerType: 'autoUpdate'`.
- Print styles target 80mm thermal receipt printers via `@media print` + `.receipt-print` class.
- Touch-optimized: `touch-action: manipulation`, `user-scalable=no`, `select-none` on buttons.
- Bootstrap phase in App.tsx: DB init → settings load → sync start → render router. Shows loading state until ready.
- No custom hooks beyond `useOnlineStatus`. All data access via `useLiveQuery` + Zustand stores.
- Tests use `fake-indexeddb/auto`. Setup deletes/reopens Dexie DB before/after each test.
