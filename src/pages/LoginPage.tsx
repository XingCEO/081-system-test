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
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-blue-600 px-8 py-6 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <IconRestaurant className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">POS 餐飲管理系統</h1>
          <p className="text-blue-200 mt-1">請選擇身份並輸入 PIN 碼</p>
        </div>

        <div className="p-8">
          {!selectedEmployee ? (
            <div>
              <h2 className="text-lg font-semibold text-slate-700 mb-4">選擇員工</h2>
              <div className="grid grid-cols-2 gap-3">
                {employees?.map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => setSelectedEmployee(emp)}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all"
                  >
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-xl font-bold text-blue-600">
                        {emp.name.charAt(0)}
                      </span>
                    </div>
                    <span className="font-medium text-slate-700">{emp.name}</span>
                    <span className="text-xs text-slate-400">
                      {emp.role === 'admin' ? '管理員' : emp.role === 'cashier' ? '收銀員' : '廚房'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <button
                onClick={() => {
                  setSelectedEmployee(null);
                  setPin('');
                  setError('');
                }}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-4 flex items-center gap-1"
              >
                ← 返回選擇
              </button>

              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-2xl font-bold text-blue-600">
                    {selectedEmployee.name.charAt(0)}
                  </span>
                </div>
                <h3 className="font-semibold text-lg">{selectedEmployee.name}</h3>
              </div>

              <div className="mb-4">
                <div className="flex justify-center gap-3 mb-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`w-4 h-4 rounded-full transition-colors ${
                        i < pin.length ? 'bg-blue-600' : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>
                {error && (
                  <p className="text-red-500 text-sm text-center">{error}</p>
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
