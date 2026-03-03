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

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-60 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-300 ease-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {filteredItems.map((item, i) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `${isActive ? 'sidebar-link-active' : 'sidebar-link'} animate-slide-up stagger-${Math.min(i + 1, 6)}`
              }
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
              {item.permission === 'inventory' && (lowStockCount ?? 0) > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center animate-bounce-in">
                  {lowStockCount}
                </span>
              )}
              {item.permission === 'kitchen' && (pendingOrderCount ?? 0) > 0 && (
                <span className="ml-auto bg-amber-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center animate-bounce-in">
                  {pendingOrderCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={handleLogout}
            className="sidebar-link w-full text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
          >
            <IconLogout className="w-5 h-5" />
            <span>登出</span>
          </button>
        </div>
      </aside>
    </>
  );
}
