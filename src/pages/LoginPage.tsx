import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import toast from 'react-hot-toast';
import { db } from '../db/database';
import type { Employee } from '../db/types';
import NumberPad from '../components/ui/NumberPad';
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

  const employees = useLiveQuery(() => db.employees.filter((employee) => employee.isActive).toArray());

  if (isAuthenticated) {
    const { currentEmployee } = useAuthStore.getState();
    if (currentEmployee) {
      navigate(getDefaultRoute(currentEmployee.role), { replace: true });
    }
  }

  const handleLogin = async () => {
    if (!selectedEmployee?.id || pin.length < 4) {
      return;
    }

    setError('');

    const result = await loginEmployee(selectedEmployee.id, pin);
    if (!result) {
      setError('PIN 錯誤');
      setPin('');
      return;
    }

    login(result.employee, result.shiftId);
    toast.success(`歡迎，${result.employee.name}！`);
    navigate(getDefaultRoute(result.employee.role), { replace: true });
  };

  const handlePinChange = (nextPin: string) => {
    setPin(nextPin);
    setError('');

    if (nextPin.length === 4) {
      window.setTimeout(() => {
        document.getElementById('login-btn')?.click();
      }, 100);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-md animate-slide-up">
        {/* Logo area */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 mb-4 shadow-lg">
            <IconRestaurant className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{storeName}</h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400 text-sm">請選擇員工並輸入 PIN 登入</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="p-6">
            {!selectedEmployee ? (
              <div>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">選擇員工</h2>
                <div className="grid grid-cols-2 gap-3">
                  {employees?.map((employee) => {
                    const role = ROLE_STYLES[employee.role] || ROLE_STYLES.cashier;
                    return (
                      <button
                        key={employee.id}
                        onClick={() => setSelectedEmployee(employee)}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors active:scale-[0.97]"
                      >
                        <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                          <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                            {employee.name.charAt(0)}
                          </span>
                        </div>
                        <span className="font-medium text-gray-700 dark:text-gray-200 text-sm">{employee.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${role.bg} ${role.text} font-medium`}>
                          {role.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="animate-fade-in">
                <button
                  onClick={() => {
                    setSelectedEmployee(null);
                    setPin('');
                    setError('');
                  }}
                  className="text-sm font-medium mb-5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  返回選擇
                </button>

                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                      {selectedEmployee.name.charAt(0)}
                    </span>
                  </div>
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{selectedEmployee.name}</h3>
                </div>

                {/* PIN dots */}
                <div className="mb-5">
                  <div className="flex justify-center gap-3 mb-3">
                    {[0, 1, 2, 3].map((index) => (
                      <div
                        key={index}
                        className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                          index < pin.length
                            ? 'bg-indigo-600 scale-110'
                            : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                      />
                    ))}
                  </div>

                  {error && (
                    <p className="text-sm text-center text-red-500 animate-shake">{error}</p>
                  )}
                </div>

                <NumberPad value={pin} onChange={handlePinChange} maxLength={4} />

                <button
                  id="login-btn"
                  onClick={handleLogin}
                  disabled={pin.length < 4}
                  className="btn-primary w-full mt-5 py-3 text-base"
                >
                  登入
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
