import { Outlet, Navigate, NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { hasPermission } from '../../services/authService';
import Header from './Header';
import Sidebar from './Sidebar';
import { IconCart, IconChair, IconChefHat, IconClipboard, IconChart } from '../ui/Icons';
import type { SVGProps } from 'react';

const BOTTOM_NAV: { path: string; label: string; icon: (props: SVGProps<SVGSVGElement>) => React.JSX.Element; permission: string }[] = [
  { path: '/pos', label: '點餐', icon: IconCart, permission: 'pos' },
  { path: '/tables', label: '桌位', icon: IconChair, permission: 'tables' },
  { path: '/kitchen', label: '廚房', icon: IconChefHat, permission: 'kitchen' },
  { path: '/orders', label: '訂單', icon: IconClipboard, permission: 'orders' },
  { path: '/analytics', label: '分析', icon: IconChart, permission: 'analytics' },
];

export default function AppShell() {
  const { isAuthenticated, currentEmployee } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const filteredBottomNav = BOTTOM_NAV.filter(
    (item) => currentEmployee && hasPermission(currentEmployee.role, item.permission)
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

      {/* Mobile Bottom Navigation */}
      <nav className={`lg:hidden flex-shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around safe-area-bottom ${isPOS ? 'hidden' : ''}`}>
        {filteredBottomNav.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              isActive ? 'bottom-nav-item-active' : 'bottom-nav-item'
            }
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
