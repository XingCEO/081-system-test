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
    <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 flex-shrink-0 transition-colors">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 lg:hidden"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 accent-gradient rounded-lg flex items-center justify-center shadow-sm">
            <span className="text-sm font-bold text-white">P</span>
          </div>
          <h1 className="hidden sm:block text-base font-bold text-slate-900 dark:text-white">
            {storeName}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {currentEmployee && (
          <div className="flex items-center gap-2 text-sm">
            <div className="w-7 h-7 accent-gradient rounded-full flex items-center justify-center shadow-sm">
              <span className="text-xs font-semibold text-white">
                {currentEmployee.name.charAt(0)}
              </span>
            </div>
            <span className="hidden sm:inline font-medium text-slate-700 dark:text-slate-300">
              {currentEmployee.name}
            </span>
          </div>
        )}

        {currentEmployee &&
          hasPermission(currentEmployee.role, 'inventory') &&
          (lowStockCount ?? 0) > 0 && (
            <button
              onClick={() => navigate('/inventory')}
              className="hidden md:flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-900/60"
              title="查看低庫存食材"
            >
              <IconWarning className="h-4 w-4" />
              <span>低庫存 {lowStockCount}</span>
            </button>
          )}

        <div className="text-sm font-mono font-semibold text-slate-600 dark:text-slate-400 tabular-nums">
          {time.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
        </div>

        <button
          onClick={cycleTheme}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
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

        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
          isOnline
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400'
            : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <span className="hidden sm:inline">{isOnline ? '連線中' : '離線'}</span>
        </div>
      </div>
    </header>
  );
}
