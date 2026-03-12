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

const ROLE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  admin: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400', label: '管理員' },
  cashier: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-600 dark:text-indigo-400', label: '收銀員' },
  kitchen: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400', label: '廚房' },
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuthStore();
  const storeName = useAppSettingsStore((state) => state.settings.storeName);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [showPin, setShowPin] = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);

  const employees = useLiveQuery(() => db.employees.filter((employee) => employee.isActive).toArray());

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
    if (!selectedEmployee?.id || pin.length < 4) {
      return;
    }

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
      window.setTimeout(() => {
        document.getElementById('login-btn')?.click();
      }, 150);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && pin.length === 4) {
      void handleLogin();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-sm animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 mb-4 shadow-lg shadow-indigo-600/20">
            <IconRestaurant className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{storeName}</h1>
          <p className="mt-1 text-gray-400 text-sm">員工登入</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="p-6">
            {!selectedEmployee ? (
              <>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">選擇員工</p>
                <div className="space-y-2">
                  {employees?.map((employee) => {
                    const role = ROLE_STYLES[employee.role] || ROLE_STYLES.cashier;
                    return (
                      <button
                        key={employee.id}
                        onClick={() => setSelectedEmployee(employee)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-indigo-200 dark:hover:border-indigo-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors active:scale-[0.98]"
                      >
                        <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                          <span className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                            {employee.name.charAt(0)}
                          </span>
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium text-gray-800 dark:text-gray-100 text-sm">{employee.name}</p>
                          <span className={`text-[11px] px-1.5 py-0.5 rounded ${role.bg} ${role.text} font-medium`}>
                            {role.label}
                          </span>
                        </div>
                        <svg className="w-4 h-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="animate-fade-in">
                {/* Back */}
                <button
                  onClick={() => {
                    setSelectedEmployee(null);
                    setPin('');
                    setError('');
                  }}
                  className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1 mb-6 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  切換員工
                </button>

                {/* Selected employee */}
                <div className="text-center mb-6">
                  <div className="w-14 h-14 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-2">
                    <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                      {selectedEmployee.name.charAt(0)}
                    </span>
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{selectedEmployee.name}</h3>
                </div>

                {/* PIN input */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
                    輸入 4 位 PIN 碼
                  </label>
                  <div className="relative">
                    <input
                      ref={pinRef}
                      type={showPin ? 'text' : 'password'}
                      inputMode="numeric"
                      maxLength={4}
                      value={pin}
                      onChange={(e) => handlePinInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="••••"
                      autoComplete="off"
                      className={`input-field text-center text-2xl tracking-[0.5em] font-mono pr-12 ${
                        error ? '!border-red-400 !ring-red-100' : ''
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1"
                    >
                      {showPin ? (
                        <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {error && (
                    <p className="text-sm text-red-500 animate-shake">{error}</p>
                  )}

                  <button
                    id="login-btn"
                    onClick={handleLogin}
                    disabled={pin.length < 4}
                    className="btn-primary w-full py-3 text-base mt-1"
                  >
                    登入
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
