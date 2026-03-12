import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db/database';
import { hasPermission } from '../../services/authService';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useAuthStore } from '../../stores/useAuthStore';
import { useAppSettingsStore } from '../../stores/useAppSettingsStore';
import { useUIStore } from '../../stores/useUIStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { IconWarning } from '../ui/Icons';
import UserAvatar from '../ui/UserAvatar';

export default function Header() {
  const navigate = useNavigate();
  const { currentEmployee } = useAuthStore();
  const storeName = useAppSettingsStore((state) => state.settings.storeName);
  const { toggleSidebar } = useUIStore();
  const { theme, setTheme } = useThemeStore();
  const isOnline = useOnlineStatus();
  const [time, setTime] = useState(new Date());
  const lowStockCount = useLiveQuery(
    () => db.inventory.filter((record) => record.currentStock <= record.lowStockThreshold).count(),
    []
  );

  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const cycleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setTheme(nextTheme);
  };

  return (
    <header className="h-14 bg-white dark:bg-[#0b1120] border-b border-gray-200 dark:border-[#1e2d4a] flex items-center justify-between px-4 flex-shrink-0 transition-colors">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-[#1a2540] text-gray-500 dark:text-slate-400 transition-colors lg:hidden"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 accent-gradient rounded-lg flex items-center justify-center">
            <span className="text-sm font-bold text-white">{storeName?.charAt(0) || 'P'}</span>
          </div>
          <h1 className="hidden sm:block text-sm font-bold text-gray-900 dark:text-slate-50">
            {storeName}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {currentEmployee && (
          <div className="flex items-center gap-2 text-sm">
            <UserAvatar name={currentEmployee.name} size={28} />
            <span className="hidden sm:inline font-medium text-gray-600 dark:text-slate-300 text-sm">
              {currentEmployee.name}
            </span>
          </div>
        )}

        {currentEmployee &&
          hasPermission(currentEmployee.role, 'inventory') &&
          (lowStockCount ?? 0) > 0 && (
            <button
              onClick={() => navigate('/inventory')}
              className="hidden md:flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/30"
              title="查看低庫存食材"
            >
              <IconWarning className="h-3.5 w-3.5" />
              <span>低庫存 {lowStockCount}</span>
            </button>
          )}

        <div className="text-xs font-mono font-medium text-gray-500 dark:text-slate-400 tabular-nums bg-gray-50 dark:bg-[#131c2e] px-2.5 py-1 rounded-lg">
          {time.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
        </div>

        <button
          onClick={cycleTheme}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-[#1a2540] text-gray-400 dark:text-slate-500 transition-colors"
          title={theme === 'light' ? '亮色模式' : theme === 'dark' ? '深色模式' : '跟隨系統'}
        >
          {theme === 'light' ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : theme === 'dark' ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          )}
        </button>

        <div className="flex items-center gap-1.5 text-xs">
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <span className={`hidden sm:inline font-medium ${isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {isOnline ? '連線中' : '離線'}
          </span>
        </div>
      </div>
    </header>
  );
}
