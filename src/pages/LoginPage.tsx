import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { useAuthStore } from '../stores/useAuthStore';
import { loginEmployee, getDefaultRoute } from '../services/authService';
import NumberPad from '../components/ui/NumberPad';
import { IconRestaurant } from '../components/ui/Icons';
import toast from 'react-hot-toast';
import type { Employee } from '../db/types';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuthStore();
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const employees = useLiveQuery(() => db.employees.filter(e => e.isActive).toArray());

  if (isAuthenticated) {
    const { currentEmployee } = useAuthStore.getState();
    if (currentEmployee) {
      navigate(getDefaultRoute(currentEmployee.role), { replace: true });
    }
  }

  const handleLogin = async () => {
    if (!selectedEmployee?.id || !pin) return;
    setError('');

    const result = await loginEmployee(selectedEmployee.id, pin);
    if (result) {
      login(result.employee, result.shiftId);
      toast.success(`歡迎，${result.employee.name}！`);
      navigate(getDefaultRoute(result.employee.role), { replace: true });
    } else {
      setError('PIN 碼錯誤');
      setPin('');
    }
  };

  const handlePinChange = (newPin: string) => {
    setPin(newPin);
    setError('');
    if (newPin.length === 4) {
      setTimeout(() => {
        const el = document.getElementById('login-btn');
        if (el) el.click();
      }, 100);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl" />
      </div>

      <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/50 dark:border-slate-700/50 animate-slide-up">
        <div className="bg-gradient-to-br from-blue-600 to-blue-800 px-8 py-8 text-center">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4 animate-bounce-in">
            <IconRestaurant className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">POS 餐飲管理系統</h1>
          <p className="text-blue-200 mt-1.5 text-sm">請選擇身份並輸入 PIN 碼</p>
        </div>

        <div className="p-6 sm:p-8">
          {!selectedEmployee ? (
            <div>
              <h2 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-4">選擇員工</h2>
              <div className="grid grid-cols-2 gap-3">
                {employees?.map((emp, i) => (
                  <button
                    key={emp.id}
                    onClick={() => setSelectedEmployee(emp)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 transition-all active:scale-95 animate-slide-up stagger-${Math.min(i + 1, 6)}`}
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center shadow-md">
                      <span className="text-xl font-bold text-white">
                        {emp.name.charAt(0)}
                      </span>
                    </div>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{emp.name}</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {emp.role === 'admin' ? '管理員' : emp.role === 'cashier' ? '收銀員' : '廚房'}
                    </span>
                  </button>
                ))}
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
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 text-sm font-medium mb-4 flex items-center gap-1 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                返回選擇
              </button>

              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg animate-bounce-in">
                  <span className="text-2xl font-bold text-white">
                    {selectedEmployee.name.charAt(0)}
                  </span>
                </div>
                <h3 className="font-semibold text-lg text-slate-900 dark:text-white">{selectedEmployee.name}</h3>
              </div>

              <div className="mb-4">
                <div className="flex justify-center gap-3 mb-3">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                        i < pin.length
                          ? 'bg-blue-600 dark:bg-blue-400 scale-110 shadow-md'
                          : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    />
                  ))}
                </div>
                {error && (
                  <p className="text-red-500 text-sm text-center animate-shake">{error}</p>
                )}
              </div>

              <NumberPad value={pin} onChange={handlePinChange} maxLength={4} />

              <button
                id="login-btn"
                onClick={handleLogin}
                disabled={pin.length < 4}
                className="btn-primary w-full mt-4 py-3 text-lg"
              >
                登入
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
