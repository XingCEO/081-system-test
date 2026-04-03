# SERVICES LAYER

Business logic between UI and data (Dexie + REST API). 14 files, 3 with tests.

## PATTERN: API-FIRST WITH DEXIE FALLBACK

Every mutation follows: try API call → on success, update local Dexie → on failure, fall back to Dexie-only operation. Read operations use `useLiveQuery()` in components (not in services). Services do NOT import Zustand stores — they only touch Dexie and the API client.

```
service function → api.post('/api/...') → update Dexie locally
                   ↓ (catch)
                   Dexie-only fallback
```

## SERVICE MAP

| Service | Responsibility | Key Exports | Cross-deps |
|---------|---------------|-------------|------------|
| `orderService` | Order lifecycle (create, status, cancel, delete) | `createOrder`, `updateOrderStatus`, `cancelOrder`, `getNextOrderNumber` | → bomService |
| `authService` | PIN hash/verify, login/logout, permissions, shifts | `hashPin`, `verifyPin`, `loginEmployee`, `hasPermission` | — |
| `bomService` | Bill of Materials — recipe CRUD, stock deduction, availability | `getProductRecipe`, `replaceProductRecipe`, `applyIngredientStockChange`, `getProductAvailabilityMap` | — |
| `inventoryService` | Ingredient CRUD, restock/adjust/waste, low-stock alerts | `createIngredient`, `restockIngredient`, `getLowStockIngredients` | → syncService |
| `analyticsService` | Revenue/order aggregation, daily summaries, Excel export | `getAnalytics`, `generateDailySummary`, `createAnalyticsWorkbookXml` | — |
| `menuService` | Category + product CRUD, archiving | `saveCategory`, `saveProduct`, `archiveProduct` | — |
| `modifierGroupService` | Modifier group + modifier CRUD | `saveModifierGroup`, `deleteModifierGroup` | — |
| `employeeService` | Employee CRUD, activate/deactivate | `saveEmployee`, `setEmployeeActive` | → authService |
| `settingsService` | App settings persistence, theme application | `loadAppSettings`, `saveAppSettings`, `applyThemeColor` | — |
| `syncService` | Full/menu data export/import, reset | `exportAllData`, `importAllData`, `resetAllData` | — |
| `tableService` | Dining table CRUD | `createTable`, `updateTable`, `deleteTable` | — |

## CROSS-SERVICE DEPENDENCIES

```
orderService → bomService (getIngredientUsageForProduct, mergeIngredientUsages)
employeeService → authService (hashPin for new employees)
inventoryService → syncService (syncNow after stock changes)
```

## TRANSACTION PATTERNS

- `bomService.replaceProductRecipeLocal`: Dexie transaction wrapping productRecipes delete+insert
- `modifierGroupService.persistModifierGroup`: Transaction wrapping modifierGroups/modifiers put+delete
- `syncService` import functions: Transaction clearing + bulk insert across multiple tables

**Known gap**: Order creation + inventory deduction in `orderService` are NOT wrapped in a single transaction (sequential calls to bomService). Potential race condition under concurrent orders.

## WHERE TO LOOK

| Task | File | Notes |
|------|------|-------|
| Change order flow | `orderService.ts` | `createOrder` handles cart→order conversion + BOM deduction |
| Fix permissions | `authService.ts` | `ROUTE_PERMISSIONS` map + `hasPermission()` |
| Add ingredient tracking | `bomService.ts` + `inventoryService.ts` | BOM for recipe math, inventory for stock |
| New analytics metric | `analyticsService.ts` | `getAnalytics()` aggregates from Dexie orders |
| Excel export format | `analyticsService.ts` | `createAnalyticsWorkbookXml()` — raw XML string builder |

## CONVENTIONS

- All services import `db` from `../db/database` and `api` from `../api/client`
- Service functions are async, return domain objects (not raw DB rows)
- Error handling: `console.warn` on API failure → silent Dexie fallback. No thrown errors to callers except critical failures
- ID params are `number`, input params are typed interfaces (`CategoryInput`, `EmployeeInput`, etc.)
- Tests co-located: `orderService.test.ts`, `analyticsService.test.ts`, `settingsService.test.ts`

## ANTI-PATTERNS

- `analyticsService.createAnalyticsWorkbookXml` (465 lines) — builds Excel XML as string concatenation. Fragile but intentional (no xlsx dependency).
- `inventoryService.applyInventoryDeltaLocal` — sequential DB updates without transaction wrapper (unlike bomService which wraps correctly).
