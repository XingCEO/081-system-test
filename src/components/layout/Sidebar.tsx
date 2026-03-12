import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { useUIStore } from '../../stores/useUIStore';
import { hasPermission } from '../../services/authService';
import { logoutEmployee } from '../../services/authService';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import {
  IconCart, IconChair, IconChefHat, IconClipboard,
  IconPencil, IconPackage, IconUsers, IconChart,
  IconSettings, IconLogout,
} from '../ui/Icons';
import React from 'react';
import type { SVGProps } from 'react';

const NAV_ITEMS: { path: string; label: string; icon: (props: SVGProps<SVGSVGElement>) => React.JSX.Element; permission: string }[] = [
  { path: '/pos', label: '點餐', icon: IconCart, permission: 'pos' },
  { path: '/tables', label: '桌位', icon: IconChair, permission: 'tables' },
  { path: '/kitchen', label: '廚房', icon: IconChefHat, permission: 'kitchen' },
  { path: '/orders', label: '訂單', icon: IconClipboard, permission: 'orders' },
  { path: '/menu-management', label: '菜單管理', icon: IconPencil, permission: 'menu' },
  { path: '/inventory', label: '庫存', icon: IconPackage, permission: 'inventory' },
  { path: '/employees', label: '員工', icon: IconUsers, permission: 'employees' },
  { path: '/analytics', label: '營運分析', icon: IconChart, permission: 'analytics' },
  { path: '/settings', label: '設定', icon: IconSettings, permission: 'settings' },
];

const MAIN_PERMISSIONS = new Set(['pos', 'tables', 'kitchen', 'orders']);

export default function Sidebar() {
  const { currentEmployee, shiftId, logout } = useAuthStore();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const navigate = useNavigate();

  const lowStockCount = useLiveQuery(
    () => db.inventory.filter((inv) => inv.currentStock <= inv.lowStockThreshold).count(),
    []
  );

  const pendingOrderCount = useLiveQuery(
    () => db.orders.where('status').anyOf(['pending', 'preparing']).count(),
    []
  );

  const handleLogout = async () => {
    if (shiftId) {
      await logoutEmployee(shiftId);
    }
    logout();
    navigate('/login');
  };

  if (!currentEmployee) return null;

  const filteredItems = NAV_ITEMS.filter((item) =>
    hasPermission(currentEmployee.role, item.permission)
  );

  // Split into main and management groups
  const mainItems = filteredItems.filter((item) => MAIN_PERMISSIONS.has(item.permission));
  const mgmtItems = filteredItems.filter((item) => !MAIN_PERMISSIONS.has(item.permission));

  const renderNavItem = (item: typeof NAV_ITEMS[number], i: number) => (
    <NavLink
      key={item.path}
      to={item.path}
      onClick={() => setSidebarOpen(false)}
      className={({ isActive }) =>
        isActive
          ? `group relative flex items-center gap-3 px-4 py-3 rounded-xl font-medium select-none
             bg-gradient-to-r from-[var(--theme-primary-soft)] to-[var(--theme-primary-soft-strong)]
             dark:from-white/[0.08] dark:to-white/[0.04]
             animate-slide-up stagger-${Math.min(i + 1, 6)}`
          : `group relative flex items-center gap-3 px-4 py-3 rounded-xl font-medium select-none
             text-slate-500 dark:text-slate-400
             hover:bg-slate-100/70 hover:text-slate-800
             dark:hover:bg-white/[0.06] dark:hover:text-slate-200
             hover:backdrop-blur-sm
             transition-all duration-200 ease-out
             animate-slide-up stagger-${Math.min(i + 1, 6)}`
      }
    >
      {({ isActive }) => (
        <>
          {/* Active indicator — gradient left bar */}
          {isActive && (
            <span
              className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full"
              style={{
                background: `linear-gradient(180deg, var(--theme-primary), var(--theme-primary-gradient-end))`,
              }}
            />
          )}

          <item.icon
            className={`w-5 h-5 flex-shrink-0 transition-colors duration-200 ${
              isActive
                ? 'text-[var(--theme-primary)] dark:text-[var(--theme-primary)]'
                : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
            }`}
          />

          <span
            className={`transition-colors duration-200 ${
              isActive
                ? 'text-[var(--theme-primary)] dark:text-white'
                : ''
            }`}
          >
            {item.label}
          </span>

          {/* Badge: low stock */}
          {item.permission === 'inventory' && (lowStockCount ?? 0) > 0 && (
            <span
              className="ml-auto min-w-[22px] px-1.5 py-0.5 rounded-full text-[11px] font-bold text-white text-center
                         bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.45)]
                         dark:bg-red-500/90 dark:shadow-[0_0_10px_rgba(239,68,68,0.35)]
                         animate-bounce-in"
            >
              {lowStockCount}
            </span>
          )}

          {/* Badge: pending orders */}
          {item.permission === 'kitchen' && (pendingOrderCount ?? 0) > 0 && (
            <span
              className="ml-auto min-w-[22px] px-1.5 py-0.5 rounded-full text-[11px] font-bold text-white text-center
                         bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.45)]
                         dark:bg-amber-500/90 dark:shadow-[0_0_10px_rgba(245,158,11,0.35)]
                         animate-bounce-in"
            >
              {pendingOrderCount}
            </span>
          )}
        </>
      )}
    </NavLink>
  );

  return (
    <>
      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-60 flex flex-col
          bg-white/95 dark:bg-[#0c0a1d]
          bg-gradient-to-r dark:from-[#0c0a1d] dark:to-[#110e24]
          border-r border-slate-200/80 dark:border-white/[0.06]
          transition-transform duration-300 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Main nav */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto scrollbar-hide">
          {/* Operations section */}
          {mainItems.length > 0 && (
            <div className="space-y-0.5">
              {mainItems.map((item, i) => renderNavItem(item, i))}
            </div>
          )}

          {/* Divider between sections */}
          {mainItems.length > 0 && mgmtItems.length > 0 && (
            <div className="my-3 mx-2 flex items-center gap-2">
              <div className="flex-1 h-px bg-slate-200/70 dark:bg-white/[0.06]" />
              <span className="text-[10px] uppercase tracking-widest font-semibold text-slate-400/70 dark:text-slate-600 select-none">
                管理
              </span>
              <div className="flex-1 h-px bg-slate-200/70 dark:bg-white/[0.06]" />
            </div>
          )}

          {/* Management section */}
          {mgmtItems.length > 0 && (
            <div className="space-y-0.5">
              {mgmtItems.map((item, i) => renderNavItem(item, i + mainItems.length))}
            </div>
          )}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-slate-200/70 dark:border-white/[0.06]">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl font-medium select-none
                       text-red-400 dark:text-red-400/80
                       hover:bg-red-50/80 hover:text-red-600
                       dark:hover:bg-red-500/[0.08] dark:hover:text-red-300
                       transition-all duration-200 ease-out"
          >
            <IconLogout className="w-5 h-5" />
            <span>登出</span>
          </button>
        </div>
      </aside>
    </>
  );
}
