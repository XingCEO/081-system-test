import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import toast from 'react-hot-toast';
import { db } from '../db/database';
import type { Employee } from '../db/types';
import { IconRestaurant } from '../components/ui/Icons';
import UserAvatar from '../components/ui/UserAvatar';
import { loginEmployee, getDefaultRoute } from '../services/authService';
import { useAuthStore } from '../stores/useAuthStore';
import { useAppSettingsStore } from '../stores/useAppSettingsStore';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

const ROLE_LABEL: Record<string, string> = {
  admin: '管理員',
  cashier: '收銀員',
  kitchen: '廚房',
};

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  cashier: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  kitchen: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
};

// Keyframe styles injected via a <style> tag inside the component
const floatKeyframes = `
@keyframes floatA {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(18px, -22px) scale(1.04); }
  66% { transform: translate(-12px, 14px) scale(0.97); }
}
@keyframes floatB {
  0%, 100% { transform: translate(0, 0) scale(1); }
  40% { transform: translate(-20px, 16px) scale(1.05); }
  70% { transform: translate(14px, -10px) scale(0.96); }
}
@keyframes floatC {
  0%, 100% { transform: translate(0, 0) scale(1); }
  30% { transform: translate(10px, 20px) scale(1.03); }
  60% { transform: translate(-16px, -8px) scale(0.98); }
}
`;

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuthStore();
  const storeName = useAppSettingsStore((state) => state.settings.storeName);
  const isOnline = useOnlineStatus();
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [time, setTime] = useState(new Date());
  const pinRef = useRef<HTMLInputElement>(null);
  const isSubmittingRef = useRef(false);

  const employees = useLiveQuery(() => db.employees.filter((e) => e.isActive).toArray());
  const productCount = useLiveQuery(() => db.products.filter(p => p.isActive).count());
  const categoryCount = useLiveQuery(() => db.categories.filter(c => c.isActive).count());

  useEffect(() => {
    if (isAuthenticated) {
      const { currentEmployee } = useAuthStore.getState();
      if (currentEmployee) {
        navigate(getDefaultRoute(currentEmployee.role), { replace: true });
      }
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedEmployee && pinRef.current) {
      pinRef.current.focus();
    }
  }, [selectedEmployee]);

  const handleLogin = async (pinOverride?: string) => {
    const pinToUse = pinOverride ?? pin;
    if (!selectedEmployee?.id || pinToUse.length < 4 || isLoading || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setError('');
    setIsLoading(true);
    try {
      const result = await loginEmployee(selectedEmployee.id, pinToUse);
      if (!result) {
        setError('PIN 碼錯誤，請重新輸入');
        setPin('');
        return;
      }
      login(result.employee, result.shiftId, useAuthStore.getState().token ?? undefined);
      toast.success(`歡迎，${result.employee.name}！`);
      navigate(getDefaultRoute(result.employee.role), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '登入失敗，請重試');
      setPin('');
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const handlePinInput = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    setPin(digits);
    setError('');
    if (digits.length === 4) {
      void handleLogin(digits);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && pin.length === 4) void handleLogin();
  };

  const dateStr = time.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const timeStr = time.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <>
      <style>{floatKeyframes}</style>
      <div className="min-h-screen flex dark:bg-[#080e1e]">

        {/* ========== Left brand panel (desktop) ========== */}
        <div
          className="hidden lg:flex lg:w-[48%] relative overflow-hidden flex-col justify-between p-12"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 20% 10%, #4f46e5 0%, transparent 60%),' +
              'radial-gradient(ellipse 60% 70% at 80% 90%, #6d28d9 0%, transparent 55%),' +
              'radial-gradient(ellipse 50% 50% at 50% 50%, #4338ca 0%, transparent 70%),' +
              'linear-gradient(160deg, #1e1b4b 0%, #312e81 40%, #3730a3 100%)',
          }}
        >
          {/* Grid dot pattern */}
          <div
            className="absolute inset-0 opacity-[0.035]"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* Floating blob A */}
          <div
            className="absolute top-[8%] right-[10%] w-80 h-80 rounded-full bg-indigo-400/20 blur-3xl"
            style={{ animation: 'floatA 14s ease-in-out infinite' }}
          />
          {/* Floating blob B */}
          <div
            className="absolute bottom-[12%] left-[5%] w-64 h-64 rounded-full bg-violet-500/20 blur-3xl"
            style={{ animation: 'floatB 18s ease-in-out infinite' }}
          />
          {/* Floating blob C */}
          <div
            className="absolute top-[40%] left-[30%] w-48 h-48 rounded-full bg-blue-400/15 blur-3xl"
            style={{ animation: 'floatC 22s ease-in-out infinite' }}
          />

          {/* Top — Logo */}
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg shadow-black/20">
              <IconRestaurant className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">{storeName}</h1>
              <p className="text-xs text-indigo-300/80">超星集團</p>
            </div>
          </div>

          {/* Center — Tagline */}
          <div className="relative z-10">
            <h2 className="text-4xl xl:text-[44px] font-bold text-white leading-[1.15] mb-5 tracking-tight">
              更聰明的方式<br />管理您的餐廳
            </h2>
            <p className="text-indigo-200/70 text-[15px] leading-relaxed mb-8 max-w-sm">
              從點餐到出餐、庫存到報表，一站式解決所有營運需求。
            </p>

            {/* Feature chips — glass card style */}
            <div className="flex flex-wrap gap-2">
              {['即時點餐', '廚房管理', '庫存追蹤', '營運報表', '多角色權限', '離線運作'].map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm bg-white/5 text-indigo-100 border border-white/15 shadow-sm"
                >
                  <svg className="w-3 h-3 text-indigo-300" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Bottom — Live system stats */}
          <div className="relative z-10 flex items-center gap-5 text-xs text-indigo-200/60">
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              {isOnline ? '連線正常' : '離線模式'}
            </div>
            <div className="w-px h-3 bg-indigo-400/20" />
            <span>{employees?.length ?? 0} 位員工</span>
            <div className="w-px h-3 bg-indigo-400/20" />
            <span>{productCount ?? 0} 項商品</span>
            <div className="w-px h-3 bg-indigo-400/20" />
            <span>{categoryCount ?? 0} 個分類</span>
          </div>
        </div>

        {/* ========== Right form panel ========== */}
        <div className="flex-1 flex flex-col bg-white dark:bg-[#0b1120]">
          {/* Top bar */}
          <div className="flex items-center justify-between px-6 pt-6 sm:px-10 sm:pt-8">
            <div className="flex items-center gap-2.5 lg:opacity-0">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
                <IconRestaurant className="w-4.5 h-4.5 text-white" />
              </div>
              <span className="font-bold text-gray-900 dark:text-slate-50 text-sm">{storeName}</span>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-gray-400 dark:text-slate-500 font-mono tabular-nums">{timeStr}</p>
              <p className="text-[10px] text-gray-300 dark:text-slate-500">{dateStr}</p>
            </div>
          </div>

          {/* Form — vertically centered */}
          <div className="flex-1 flex items-center justify-center px-6 sm:px-10 pb-6">
            <div className="w-full max-w-[380px]">

              {!selectedEmployee ? (
                <div className="animate-fade-in">
                  <div className="mb-8">
                    <h2 className="text-[28px] font-bold text-gray-900 dark:text-slate-50 leading-tight">歡迎回來</h2>
                    <p className="text-gray-400 mt-2 text-[15px]">選擇您的帳號以繼續</p>
                  </div>

                  <div className="space-y-2">
                    {employees?.map((employee) => (
                      <button
                        key={employee.id}
                        onClick={() => setSelectedEmployee(employee)}
                        className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border border-gray-100 dark:border-[#1e2d4a]/60 hover:bg-gray-50 hover:border-gray-200 hover:shadow-md dark:hover:bg-[#1a2540] dark:hover:border-[#2a3a5a] transition-all duration-200 active:scale-[0.99] hover:scale-[1.02] group"
                      >
                        <UserAvatar name={employee.name} size={44} className="flex-shrink-0" />
                        <div className="flex-1 text-left min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-slate-100 text-[15px] truncate">
                            {employee.name}
                          </p>
                          <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${ROLE_BADGE[employee.role] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>
                            {ROLE_LABEL[employee.role] || employee.role}
                          </span>
                        </div>
                        <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-[#131c2e] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Test credentials */}
                  {(
                    <div className="mt-8 p-4 rounded-2xl bg-gray-50 dark:bg-[#131c2e]/50 border border-gray-100 dark:border-[#1e2d4a]/50">
                      <p className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2.5">測試帳號 PIN 碼</p>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { name: '管理員', pin: '0000' },
                          { name: '小明', pin: '1234' },
                          { name: '阿華', pin: '5678' },
                        ].map((item) => (
                          <div key={item.pin} className="text-center">
                            <p className="text-xs text-gray-500 dark:text-slate-400">{item.name}</p>
                            <p className="text-sm font-bold text-gray-800 dark:text-slate-200 font-mono tracking-widest mt-0.5">{item.pin}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="animate-fade-in">
                  {/* Back */}
                  <button
                    onClick={() => { setSelectedEmployee(null); setPin(''); setError(''); }}
                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors mb-8 group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-[#131c2e] flex items-center justify-center group-hover:bg-gray-200 dark:group-hover:bg-[#1a2540] transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                      </svg>
                    </div>
                    <span>切換帳號</span>
                  </button>

                  {/* Selected user */}
                  <div className="flex items-center gap-4 mb-8">
                    <UserAvatar name={selectedEmployee.name} size={56} className="flex-shrink-0 shadow-lg" />
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-slate-50">{selectedEmployee.name}</h3>
                      <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${ROLE_BADGE[selectedEmployee.role] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>
                        {ROLE_LABEL[selectedEmployee.role] || selectedEmployee.role}
                      </span>
                    </div>
                  </div>

                  {/* PIN form */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                        PIN 碼
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowPin(!showPin)}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                      >
                        {showPin ? (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.98 8.223A10.477 10.477 0 001.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                            </svg>
                            隱藏
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            顯示
                          </>
                        )}
                      </button>
                    </div>

                    {/* Hidden real input */}
                    <input
                      ref={pinRef}
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={pin}
                      onChange={(e) => handlePinInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      autoComplete="off"
                      className="sr-only"
                      aria-label="PIN 碼輸入"
                    />

                    {/* 4 visual digit boxes */}
                    <div
                      className="flex gap-3 mb-4 cursor-text"
                      onClick={() => pinRef.current?.focus()}
                    >
                      {[0, 1, 2, 3].map((i) => {
                        const isFilled = pin.length > i;
                        const isActive = pin.length === i;
                        return (
                          <div
                            key={i}
                            className={`
                              flex-1 h-14 rounded-xl border-2 flex items-center justify-center text-xl font-bold
                              transition-all duration-150 select-none
                              ${error
                                ? 'border-red-400 bg-red-50 dark:bg-red-900/10 dark:border-red-500/60'
                                : isActive
                                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-2 ring-indigo-500/30'
                                  : isFilled
                                    ? 'border-indigo-300 bg-white dark:bg-[#1a2540] dark:border-indigo-400/50'
                                    : 'border-gray-200 bg-gray-50 dark:bg-[#131c2e] dark:border-[#1e2d4a]'
                              }
                            `}
                          >
                            {isFilled ? (
                              showPin ? (
                                <span className="text-gray-900 dark:text-slate-100">{pin[i]}</span>
                              ) : (
                                <span className="text-indigo-500 dark:text-indigo-400 text-2xl leading-none" style={{ marginTop: '2px' }}>●</span>
                              )
                            ) : (
                              isActive ? (
                                <span className="w-0.5 h-6 bg-indigo-500 rounded-full animate-pulse" />
                              ) : null
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/30 mb-4 animate-shake">
                        <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                      </div>
                    )}

                    <button
                      id="login-btn"
                      onClick={() => void handleLogin()}
                      disabled={pin.length < 4 || isLoading}
                      className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-gray-200 dark:disabled:bg-[#131c2e] text-white disabled:text-gray-400 font-semibold text-base transition-all disabled:cursor-not-allowed shadow-sm shadow-indigo-600/20 disabled:shadow-none"
                    >
                      {isLoading ? '登入中...' : '登入'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom status bar — frosted glass */}
          <div className="px-6 pb-5 sm:px-10">
            <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-gray-50/80 dark:bg-[#131c2e]/60 backdrop-blur-sm border border-gray-100 dark:border-[#1e2d4a]/40 text-[11px] text-gray-400 dark:text-slate-500">
              <div className="flex items-center gap-3">
                <span className="font-medium">超星集團 POS v2.0</span>
                <div className="w-px h-3 bg-gray-200 dark:bg-[#1a2540]" />
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                  {isOnline ? '連線正常' : '離線中'}
                </div>
                <div className="w-px h-3 bg-gray-200 dark:bg-[#1a2540]" />
                <span>{employees?.length ?? '-'} 員工</span>
                <div className="w-px h-3 bg-gray-200 dark:bg-[#1a2540]" />
                <span>{productCount ?? '-'} 品項</span>
              </div>
              <span className="font-mono tabular-nums">{timeStr}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
