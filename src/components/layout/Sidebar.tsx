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

  const mainItems = filteredItems.filter((item) => MAIN_PERMISSIONS.has(item.permission));
  const mgmtItems = filteredItems.filter((item) => !MAIN_PERMISSIONS.has(item.permission));

  const renderNavItem = (item: typeof NAV_ITEMS[number]) => (
    <NavLink
      key={item.path}
      to={item.path}
      onClick={() => setSidebarOpen(false)}
      className={({ isActive }) =>
        isActive
          ? 'flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium select-none bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400'
          : 'flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium select-none text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors'
      }
    >
      {({ isActive }) => (
        <>
          <item.icon
            className={`w-5 h-5 flex-shrink-0 ${
              isActive
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-gray-400 dark:text-gray-500'
            }`}
          />

          <span>{item.label}</span>

          {item.permission === 'inventory' && (lowStockCount ?? 0) > 0 && (
            <span className="ml-auto min-w-[20px] px-1.5 py-0.5 rounded-full text-[11px] font-bold text-white text-center bg-red-500">
              {lowStockCount}
            </span>
          )}

          {item.permission === 'kitchen' && (pendingOrderCount ?? 0) > 0 && (
            <span className="ml-auto min-w-[20px] px-1.5 py-0.5 rounded-full text-[11px] font-bold text-white text-center bg-amber-500">
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
          className="fixed inset-0 bg-black/30 z-30 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-56 flex flex-col
          bg-white dark:bg-gray-900
          border-r border-gray-200 dark:border-gray-700
          transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <nav className="flex-1 px-3 py-3 overflow-y-auto scrollbar-hide">
          {mainItems.length > 0 && (
            <div className="space-y-0.5">
              {mainItems.map((item) => renderNavItem(item))}
            </div>
          )}

          {mainItems.length > 0 && mgmtItems.length > 0 && (
            <div className="my-3 mx-2">
              <div className="h-px bg-gray-200 dark:bg-gray-700" />
              <p className="text-[10px] uppercase tracking-widest font-semibold text-gray-400 dark:text-gray-500 mt-3 mb-1 px-1">
                管理
              </p>
            </div>
          )}

          {mgmtItems.length > 0 && (
            <div className="space-y-0.5">
              {mgmtItems.map((item) => renderNavItem(item))}
            </div>
          )}
        </nav>

        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl font-medium select-none
                       text-gray-400 hover:bg-red-50 hover:text-red-600
                       dark:text-gray-500 dark:hover:bg-red-900/10 dark:hover:text-red-400
                       transition-colors"
          >
            <IconLogout className="w-5 h-5" />
            <span>登出</span>
          </button>
        </div>
      </aside>
    </>
  );
}
