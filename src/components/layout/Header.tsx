import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useUIStore } from '../../stores/useUIStore';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export default function Header() {
  const { currentEmployee } = useAuthStore();
  const { toggleSidebar } = useUIStore();
  const isOnline = useOnlineStatus();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 shadow-sm flex-shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 lg:hidden"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 hidden sm:block">POS 餐飲系統</h1>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {currentEmployee && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
              <span className="font-medium text-slate-700">
                {currentEmployee.name.charAt(0)}
              </span>
            </div>
            <span className="hidden sm:inline font-medium">{currentEmployee.name}</span>
          </div>
        )}

        <div className="text-lg font-mono font-semibold text-slate-700">
          {time.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
        </div>

        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
          isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
        }`}>
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
          {isOnline ? '已連線' : '離線'}
        </div>
      </div>
    </header>
  );
}
