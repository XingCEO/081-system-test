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

const floatKeyframes = `
@keyframes float-slow {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(30px, -40px) scale(1.05); }
  50% { transform: translate(-20px, 20px) scale(0.95); }
  75% { transform: translate(15px, 30px) scale(1.02); }
}
@keyframes float-slower {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(-40px, 30px) scale(1.08); }
  66% { transform: translate(25px, -25px) scale(0.96); }
}
@keyframes float-slowest {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(-15px, -35px) scale(1.04); }
}
@keyframes glow-ring {
  0%, 100% { box-shadow: 0 0 20px rgba(129, 90, 213, 0.3), 0 0 60px rgba(99, 102, 241, 0.1); }
  50% { box-shadow: 0 0 30px rgba(129, 90, 213, 0.5), 0 0 80px rgba(99, 102, 241, 0.2); }
}
@keyframes particle-drift {
  0%, 100% { transform: translateY(0) translateX(0) scale(1); opacity: 0.4; }
  25% { transform: translateY(-60px) translateX(20px) scale(1.2); opacity: 0.7; }
  50% { transform: translateY(-30px) translateX(-15px) scale(0.9); opacity: 0.3; }
  75% { transform: translateY(-80px) translateX(10px) scale(1.1); opacity: 0.6; }
}
`;

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
    <>
      <style>{floatKeyframes}</style>
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ backgroundColor: '#0c0a1d' }}>

        {/* Animated gradient orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Large indigo orb — top right */}
          <div
            className="absolute rounded-full blur-3xl opacity-60"
            style={{
              width: '500px',
              height: '500px',
              top: '-10%',
              right: '-5%',
              background: 'radial-gradient(circle, rgba(99, 102, 241, 0.5) 0%, rgba(79, 70, 229, 0.3) 40%, transparent 70%)',
              animation: 'float-slow 20s ease-in-out infinite',
            }}
          />
          {/* Violet orb — bottom left */}
          <div
            className="absolute rounded-full blur-3xl opacity-50"
            style={{
              width: '450px',
              height: '450px',
              bottom: '-12%',
              left: '-8%',
              background: 'radial-gradient(circle, rgba(139, 92, 246, 0.5) 0%, rgba(167, 139, 250, 0.25) 45%, transparent 70%)',
              animation: 'float-slower 25s ease-in-out infinite',
            }}
          />
          {/* Cyan/teal orb — center */}
          <div
            className="absolute rounded-full blur-3xl opacity-30"
            style={{
              width: '350px',
              height: '350px',
              top: '40%',
              left: '35%',
              background: 'radial-gradient(circle, rgba(6, 182, 212, 0.4) 0%, rgba(20, 184, 166, 0.2) 50%, transparent 70%)',
              animation: 'float-slowest 30s ease-in-out infinite',
            }}
          />
        </div>

        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute w-2 h-2 rounded-full"
            style={{
              top: '20%',
              left: '15%',
              background: 'linear-gradient(135deg, rgba(129, 140, 248, 0.6), rgba(167, 139, 250, 0.4))',
              filter: 'blur(1px)',
              animation: 'particle-drift 15s ease-in-out infinite',
            }}
          />
          <div
            className="absolute w-1.5 h-1.5 rounded-full"
            style={{
              top: '60%',
              right: '20%',
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.5), rgba(99, 102, 241, 0.3))',
              filter: 'blur(1px)',
              animation: 'particle-drift 18s ease-in-out infinite 3s',
            }}
          />
          <div
            className="absolute w-1 h-1 rounded-full"
            style={{
              top: '75%',
              left: '60%',
              background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.5), rgba(139, 92, 246, 0.3))',
              filter: 'blur(0.5px)',
              animation: 'particle-drift 22s ease-in-out infinite 6s',
            }}
          />
        </div>

        {/* Login card */}
        <div className="relative w-full max-w-md overflow-hidden rounded-3xl animate-slide-up"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.05), 0 25px 50px rgba(0, 0, 0, 0.4), 0 0 100px rgba(99, 102, 241, 0.05)',
          }}
        >
          {/* Header with gradient background */}
          <div className="relative px-8 py-10 text-center overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.9) 0%, rgba(139, 92, 246, 0.9) 50%, rgba(124, 58, 237, 0.9) 100%)',
            }}
          >
            {/* Header decorative shimmer */}
            <div className="absolute inset-0 opacity-20"
              style={{
                background: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%)',
              }}
            />

            {/* Logo with glow ring */}
            <div className="relative inline-flex items-center justify-center mx-auto mb-5">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center animate-bounce-in"
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(10px)',
                  animation: 'glow-ring 3s ease-in-out infinite, bounce-in 0.5s ease-out',
                }}
              >
                <IconRestaurant className="w-10 h-10 text-white" />
              </div>
            </div>

            <h1 className="text-3xl font-bold text-white tracking-tight">{storeName}</h1>
            <p className="mt-2 text-base text-white/70 font-light">請選擇員工並輸入 PIN 登入</p>
          </div>

          {/* Content area */}
          <div className="p-6 sm:p-8">
            {!selectedEmployee ? (
              <div>
                <h2 className="text-base font-semibold text-white/70 mb-5 tracking-wide uppercase" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>選擇員工</h2>
                <div className="grid grid-cols-2 gap-3">
                  {employees?.map((employee, index) => (
                    <button
                      key={employee.id}
                      onClick={() => setSelectedEmployee(employee)}
                      className={`group flex flex-col items-center gap-2.5 p-5 rounded-2xl transition-all duration-300 active:scale-95 animate-slide-up ${index < 6 ? `stagger-${index + 1}` : ''}`}
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        backdropFilter: 'blur(10px)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)';
                        e.currentTarget.style.borderColor = 'rgba(129, 140, 248, 0.3)';
                        e.currentTarget.style.boxShadow = '0 0 25px rgba(99, 102, 241, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      {/* Avatar with gradient border */}
                      <div className="relative">
                        <div
                          className="w-14 h-14 rounded-full flex items-center justify-center"
                          style={{
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #a78bfa)',
                            padding: '2px',
                          }}
                        >
                          <div className="w-full h-full rounded-full flex items-center justify-center"
                            style={{ background: '#1a1630' }}
                          >
                            <span className="text-xl font-bold text-white/90">
                              {employee.name.charAt(0)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="font-medium text-white/85 text-sm">{employee.name}</span>
                      <span
                        className="text-xs px-2.5 py-0.5 rounded-full"
                        style={{
                          background: employee.role === 'admin'
                            ? 'rgba(239, 68, 68, 0.15)'
                            : employee.role === 'cashier'
                              ? 'rgba(99, 102, 241, 0.15)'
                              : 'rgba(16, 185, 129, 0.15)',
                          color: employee.role === 'admin'
                            ? 'rgba(252, 165, 165, 0.9)'
                            : employee.role === 'cashier'
                              ? 'rgba(165, 180, 252, 0.9)'
                              : 'rgba(110, 231, 183, 0.9)',
                          border: `1px solid ${employee.role === 'admin'
                            ? 'rgba(239, 68, 68, 0.2)'
                            : employee.role === 'cashier'
                              ? 'rgba(99, 102, 241, 0.2)'
                              : 'rgba(16, 185, 129, 0.2)'}`,
                        }}
                      >
                        {employee.role === 'admin'
                          ? '管理員'
                          : employee.role === 'cashier'
                            ? '收銀員'
                            : '廚房'}
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
                  className="text-sm font-medium mb-5 flex items-center gap-1.5 transition-all duration-200 group"
                  style={{ color: 'rgba(165, 180, 252, 0.8)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(165, 180, 252, 1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(165, 180, 252, 0.8)'; }}
                >
                  <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  返回選擇
                </button>

                <div className="text-center mb-7">
                  {/* Selected employee avatar with glow */}
                  <div className="relative inline-flex mb-4">
                    <div
                      className="w-20 h-20 rounded-full flex items-center justify-center animate-bounce-in"
                      style={{
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #a78bfa)',
                        padding: '3px',
                        boxShadow: '0 0 30px rgba(99, 102, 241, 0.3), 0 0 60px rgba(139, 92, 246, 0.15)',
                      }}
                    >
                      <div className="w-full h-full rounded-full flex items-center justify-center"
                        style={{ background: '#1a1630' }}
                      >
                        <span className="text-3xl font-bold text-white/90">
                          {selectedEmployee.name.charAt(0)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <h3 className="font-semibold text-xl text-white tracking-tight">{selectedEmployee.name}</h3>
                </div>

                {/* PIN dots */}
                <div className="mb-5">
                  <div className="flex justify-center gap-4 mb-4">
                    {[0, 1, 2, 3].map((index) => (
                      <div
                        key={index}
                        className="w-4 h-4 rounded-full transition-all duration-300"
                        style={
                          index < pin.length
                            ? {
                                background: 'linear-gradient(135deg, #6366f1, #a78bfa)',
                                transform: 'scale(1.2)',
                                boxShadow: '0 0 12px rgba(99, 102, 241, 0.5), 0 0 24px rgba(139, 92, 246, 0.2)',
                              }
                            : {
                                background: 'rgba(255, 255, 255, 0.08)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                              }
                        }
                      />
                    ))}
                  </div>

                  {error && (
                    <p className="text-sm text-center text-red-400 animate-shake">{error}</p>
                  )}
                </div>

                <NumberPad value={pin} onChange={handlePinChange} maxLength={4} />

                <button
                  id="login-btn"
                  onClick={handleLogin}
                  disabled={pin.length < 4}
                  className="w-full mt-5 py-3.5 text-lg font-semibold rounded-xl transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed text-white"
                  style={{
                    background: pin.length >= 4
                      ? 'linear-gradient(135deg, #6366f1, #8b5cf6, #a78bfa)'
                      : 'rgba(255, 255, 255, 0.05)',
                    boxShadow: pin.length >= 4
                      ? '0 0 25px rgba(99, 102, 241, 0.3), 0 10px 30px rgba(139, 92, 246, 0.2)'
                      : 'none',
                    border: pin.length >= 4
                      ? 'none'
                      : '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                >
                  登入
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
