import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import toast from 'react-hot-toast';
import { db } from '../db/database';
import type { Employee } from '../db/types';
import { IconRestaurant } from '../components/ui/Icons';
import { loginEmployee, getDefaultRoute } from '../services/authService';
import { useAuthStore } from '../stores/useAuthStore';
import { useAppSettingsStore } from '../stores/useAppSettingsStore';

const ROLE_LABEL: Record<string, string> = {
  admin: '管理員',
  cashier: '收銀員',
  kitchen: '廚房',
};

const AVATAR_COLORS = [
  'bg-indigo-600', 'bg-violet-600', 'bg-sky-600', 'bg-teal-600',
  'bg-rose-600', 'bg-amber-600', 'bg-emerald-600', 'bg-fuchsia-600',
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuthStore();
  const storeName = useAppSettingsStore((state) => state.settings.storeName);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [showPin, setShowPin] = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);

  const employees = useLiveQuery(() => db.employees.filter((e) => e.isActive).toArray());

  if (isAuthenticated) {
    const { currentEmployee } = useAuthStore.getState();
    if (currentEmployee) {
      navigate(getDefaultRoute(currentEmployee.role), { replace: true });
    }
  }

  useEffect(() => {
    if (selectedEmployee && pinRef.current) {
      pinRef.current.focus();
    }
  }, [selectedEmployee]);

  const handleLogin = async () => {
    if (!selectedEmployee?.id || pin.length < 4) return;
    setError('');
    const result = await loginEmployee(selectedEmployee.id, pin);
    if (!result) {
      setError('PIN 碼錯誤，請重新輸入');
      setPin('');
      return;
    }
    login(result.employee, result.shiftId);
    toast.success(`歡迎，${result.employee.name}！`);
    navigate(getDefaultRoute(result.employee.role), { replace: true });
  };

  const handlePinInput = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    setPin(digits);
    setError('');
    if (digits.length === 4) {
      window.setTimeout(() => { document.getElementById('login-btn')?.click(); }, 150);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && pin.length === 4) void handleLogin();
  };

  return (
    <div className="min-h-screen flex dark:bg-gray-950">
      {/* Left brand panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[50%] relative overflow-hidden items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 40%, #818cf8 100%)' }}
      >
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative z-10 px-12 max-w-md text-center">
          <div className="w-20 h-20 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center mx-auto mb-8 border border-white/20">
            <IconRestaurant className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">{storeName}</h1>
          <p className="text-indigo-200 text-base leading-relaxed">
            餐飲管理系統
          </p>
          <div className="mt-10 flex items-center justify-center gap-6 text-indigo-200/70 text-sm">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>即時點餐</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>庫存追蹤</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>營運分析</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-white dark:bg-gray-900">
        <div className="w-full max-w-[380px]">
          {/* Mobile logo — visible only on small screens */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 mb-3">
              <IconRestaurant className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">{storeName}</h1>
          </div>

          {!selectedEmployee ? (
            <div className="animate-fade-in">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">歡迎回來</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">選擇您的帳號以繼續</p>
              </div>

              <div className="space-y-2">
                {employees?.map((employee, i) => {
                  const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
                  return (
                    <button
                      key={employee.id}
                      onClick={() => setSelectedEmployee(employee)}
                      className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors active:scale-[0.99] group"
                    >
                      <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-sm font-semibold text-white">
                          {employee.name.charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-medium text-gray-900 dark:text-gray-100 text-[15px] truncate">
                          {employee.name}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {ROLE_LABEL[employee.role] || employee.role}
                        </p>
                      </div>
                      <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="animate-fade-in">
              {/* Selected user header */}
              <div className="flex items-center gap-3 mb-8">
                <button
                  onClick={() => { setSelectedEmployee(null); setPin(''); setError(''); }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-full ${AVATAR_COLORS[(employees?.findIndex(e => e.id === selectedEmployee.id) ?? 0) % AVATAR_COLORS.length]} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-sm font-semibold text-white">
                      {selectedEmployee.name.charAt(0)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white text-[15px] truncate">{selectedEmployee.name}</p>
                    <p className="text-xs text-gray-400">{ROLE_LABEL[selectedEmployee.role] || selectedEmployee.role}</p>
                  </div>
                </div>
              </div>

              {/* PIN form */}
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">輸入 PIN 碼</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">請輸入您的 4 位數 PIN 碼</p>

                <div className="space-y-4">
                  <div className="relative">
                    <input
                      ref={pinRef}
                      type={showPin ? 'text' : 'password'}
                      inputMode="numeric"
                      maxLength={4}
                      value={pin}
                      onChange={(e) => handlePinInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="輸入 PIN 碼"
                      autoComplete="off"
                      className={`w-full h-12 px-4 pr-11 rounded-xl text-base transition-all border bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none ${
                        error
                          ? 'border-red-400 focus:ring-red-400/20 focus:border-red-400'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      {showPin ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.98 8.223A10.477 10.477 0 001.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {error && (
                    <p className="text-sm text-red-500 flex items-center gap-1.5 animate-shake">
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {error}
                    </p>
                  )}

                  <button
                    id="login-btn"
                    onClick={handleLogin}
                    disabled={pin.length < 4}
                    className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-base transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    登入
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Test credentials */}
          <div className="mt-8 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              測試帳號
            </p>
            <div className="space-y-1 text-xs text-amber-800/80 dark:text-amber-300/70 font-mono">
              <p>管理員 — PIN: <span className="font-bold text-amber-900 dark:text-amber-300">0000</span></p>
              <p>收銀員小明 — PIN: <span className="font-bold text-amber-900 dark:text-amber-300">1234</span></p>
              <p>廚師阿華 — PIN: <span className="font-bold text-amber-900 dark:text-amber-300">5678</span></p>
            </div>
          </div>

          <p className="text-center text-xs text-gray-300 dark:text-gray-600 mt-4">
            POS 餐飲管理系統 v2.0
          </p>
        </div>
      </div>
    </div>
  );
}
