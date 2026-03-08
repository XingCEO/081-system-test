import { useEffect, useRef, type SVGProps } from 'react';
import { Outlet, Navigate, NavLink, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { logoutEmployee, getDefaultRoute, hasPermission } from '../../services/authService';
import { useAuthStore } from '../../stores/useAuthStore';
import { useAppSettingsStore } from '../../stores/useAppSettingsStore';
import Header from './Header';
import Sidebar from './Sidebar';
import { IconCart, IconChair, IconChefHat, IconClipboard, IconChart } from '../ui/Icons';

const BOTTOM_NAV: {
  path: string;
  label: string;
  icon: (props: SVGProps<SVGSVGElement>) => React.JSX.Element;
  permission: string;
}[] = [
  { path: '/pos', label: '點餐', icon: IconCart, permission: 'pos' },
  { path: '/tables', label: '桌位', icon: IconChair, permission: 'tables' },
  { path: '/kitchen', label: '廚房', icon: IconChefHat, permission: 'kitchen' },
  { path: '/orders', label: '訂單', icon: IconClipboard, permission: 'orders' },
  { path: '/analytics', label: '分析', icon: IconChart, permission: 'analytics' },
];

const ROUTE_PERMISSIONS = [
  { path: '/menu-management', permission: 'menu' },
  { path: '/inventory', permission: 'inventory' },
  { path: '/employees', permission: 'employees' },
  { path: '/analytics', permission: 'analytics' },
  { path: '/settings', permission: 'settings' },
  { path: '/orders', permission: 'orders' },
  { path: '/kitchen', permission: 'kitchen' },
  { path: '/tables', permission: 'tables' },
  { path: '/pos', permission: 'pos' },
] as const;

export default function AppShell() {
  const { currentEmployee, isAuthenticated, logout, shiftId } = useAuthStore();
  const autoLogoutMinutes = useAppSettingsStore((state) => state.settings.autoLogoutMinutes);
  const location = useLocation();
  const logoutInProgressRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !currentEmployee || !shiftId || autoLogoutMinutes <= 0) {
      return;
    }

    let timeoutId = 0;

    const handleAutoLogout = async () => {
      if (logoutInProgressRef.current) {
        return;
      }

      logoutInProgressRef.current = true;

      try {
        await logoutEmployee(shiftId);
      } finally {
        logout();
        toast('因閒置過久，已自動登出');
        logoutInProgressRef.current = false;
      }
    };

    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        void handleAutoLogout();
      }, autoLogoutMinutes * 60 * 1000);
    };

    const activityEvents: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'scroll'];

    for (const eventName of activityEvents) {
      window.addEventListener(eventName, resetTimer);
    }

    resetTimer();

    return () => {
      window.clearTimeout(timeoutId);

      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, resetTimer);
      }
    };
  }, [autoLogoutMinutes, currentEmployee, isAuthenticated, logout, shiftId]);

  if (!isAuthenticated || !currentEmployee) {
    return <Navigate to="/login" replace />;
  }

  const routePermission = ROUTE_PERMISSIONS.find((item) =>
    location.pathname.startsWith(item.path)
  );

  if (routePermission && !hasPermission(currentEmployee.role, routePermission.permission)) {
    return <Navigate to={getDefaultRoute(currentEmployee.role)} replace />;
  }

  const filteredBottomNav = BOTTOM_NAV.filter((item) =>
    hasPermission(currentEmployee.role, item.permission)
  );

  const isPOS = location.pathname === '/pos';

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950">
          <Outlet />
        </main>
      </div>

      <nav className={`lg:hidden flex-shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around safe-area-bottom ${isPOS ? 'hidden' : ''}`}>
        {filteredBottomNav.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => (isActive ? 'bottom-nav-item-active' : 'bottom-nav-item')}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
