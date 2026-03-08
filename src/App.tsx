import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { initializeDatabase } from './db/database';
import AppShell from './components/layout/AppShell';
import { IconRestaurant } from './components/ui/Icons';
import { useAppSettingsStore } from './stores/useAppSettingsStore';
// Initialize theme on app load
import './stores/useThemeStore';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const POSPage = lazy(() => import('./pages/POSPage'));
const TableMapPage = lazy(() => import('./pages/TableMapPage'));
const KitchenPage = lazy(() => import('./pages/KitchenPage'));
const OrderHistoryPage = lazy(() => import('./pages/OrderHistoryPage'));
const MenuManagementPage = lazy(() => import('./pages/MenuManagementPage'));
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const EmployeePage = lazy(() => import('./pages/EmployeePage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function PageLoader() {
  return (
    <div className="h-full flex items-center justify-center">
      <div
        className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: 'var(--theme-primary)', borderTopColor: 'transparent' }}
      />
    </div>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        await initializeDatabase();
        await useAppSettingsStore.getState().loadSettings();
      } catch (err) {
        console.error('Init failed:', err);
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 accent-gradient rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse shadow-lg">
            <IconRestaurant className="w-8 h-8 text-white" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">系統載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 2000,
          style: {
            borderRadius: '12px',
            padding: '12px 20px',
            fontSize: '14px',
            fontWeight: 500,
            background: 'var(--toast-bg, #fff)',
            color: 'var(--toast-color, #334155)',
          },
        }}
      />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AppShell />}>
            <Route path="/pos" element={<POSPage />} />
            <Route path="/tables" element={<TableMapPage />} />
            <Route path="/kitchen" element={<KitchenPage />} />
            <Route path="/orders" element={<OrderHistoryPage />} />
            <Route path="/menu-management" element={<MenuManagementPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/employees" element={<EmployeePage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
