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
import { fetchPublicEmployees } from '../api/sync';

const ROLE_LABEL: Record<string, string> = {
  admin: '管理員',
  cashier: '收銀員',
  kitchen: '廚房',
};

const ROLE_COLOR: Record<string, { bg: string; text: string; glow: string }> = {
  admin: { bg: 'from-purple-500 to-violet-600', text: 'text-purple-100', glow: 'shadow-purple-500/30' },
  cashier: { bg: 'from-blue-500 to-cyan-600', text: 'text-blue-100', glow: 'shadow-blue-500/30' },
  kitchen: { bg: 'from-orange-500 to-amber-600', text: 'text-orange-100', glow: 'shadow-orange-500/30' },
};

const keyframes = `
@keyframes drift1 { 0%,100%{transform:translate(0,0) rotate(0deg)} 50%{transform:translate(30px,-40px) rotate(6deg)} }
@keyframes drift2 { 0%,100%{transform:translate(0,0) rotate(0deg)} 50%{transform:translate(-40px,30px) rotate(-8deg)} }
@keyframes drift3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(20px,20px) scale(1.08)} }
@keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
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

  // If Dexie has no employees (fresh install / cleared data), fetch from public endpoint
  useEffect(() => {
    if (employees !== undefined && employees.length === 0) {
      void fetchPublicEmployees();
    }
  }, [employees]);

  useEffect(() => {
    if (isAuthenticated) {
      const { currentEmployee } = useAuthStore.getState();
      if (currentEmployee) navigate(getDefaultRoute(currentEmployee.role), { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedEmployee && pinRef.current) pinRef.current.focus();
  }, [selectedEmployee]);

  const handleLogin = async (pinOverride?: string) => {
    const pinToUse = pinOverride ?? pin;
    if (!selectedEmployee?.id || pinToUse.length < 4 || isLoading || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setError('');
    setIsLoading(true);
    try {
      const result = await loginEmployee(selectedEmployee.id, pinToUse);
      if (!result) { setError('PIN 碼錯誤'); setPin(''); return; }
      login(result.employee, result.shiftId, useAuthStore.getState().token ?? undefined);
      toast.success(`歡迎，${result.employee.name}！`);
      navigate(getDefaultRoute(result.employee.role), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : '登入失敗');
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
    if (digits.length === 4) void handleLogin(digits);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && pin.length === 4) void handleLogin();
  };

  const timeStr = time.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
  const dateStr = time.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric', weekday: 'short' });

  return (
    <>
      <style>{keyframes}</style>
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4"
        style={{
          background: 'linear-gradient(135deg, #0f0c29 0%, #1a1145 25%, #302b63 50%, #24243e 75%, #0f0c29 100%)',
        }}
      >
        {/* Geometric background shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Large triangle - top left */}
          <div className="absolute -top-20 -left-20 w-[500px] h-[500px] opacity-[0.07]"
            style={{ animation: 'drift1 20s ease-in-out infinite', background: 'linear-gradient(135deg, #6366f1, transparent)', clipPath: 'polygon(0 0, 100% 0, 0 100%)' }} />
          {/* Circle - top right */}
          <div className="absolute -top-32 -right-32 w-[400px] h-[400px] rounded-full opacity-[0.08]"
            style={{ animation: 'drift2 25s ease-in-out infinite', background: 'radial-gradient(circle, #a78bfa, transparent 70%)' }} />
          {/* Diamond - bottom left */}
          <div className="absolute -bottom-16 left-[10%] w-[300px] h-[300px] opacity-[0.06] rotate-45"
            style={{ animation: 'drift3 18s ease-in-out infinite', background: 'linear-gradient(180deg, #818cf8, transparent)' }} />
          {/* Small circle - center right */}
          <div className="absolute top-[60%] right-[15%] w-[200px] h-[200px] rounded-full opacity-[0.05]"
            style={{ animation: 'drift1 22s ease-in-out infinite reverse', background: 'radial-gradient(circle, #c4b5fd, transparent 60%)' }} />
          {/* Hexagon-ish - bottom right */}
          <div className="absolute -bottom-24 -right-24 w-[350px] h-[350px] opacity-[0.07]"
            style={{ animation: 'drift2 16s ease-in-out infinite reverse', background: 'linear-gradient(45deg, #7c3aed, transparent)', clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }} />
          {/* Dot grid overlay */}
          <div className="absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        </div>

        {/* Top bar - floating */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 sm:px-10 sm:py-6 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <IconRestaurant className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm tracking-tight">{storeName}</p>
              <p className="text-white/40 text-[10px]">超星集團</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-white/50 text-xs">
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
              <span>{isOnline ? '已連線' : '離線'}</span>
            </div>
            <span className="font-mono tabular-nums">{timeStr}</span>
          </div>
        </div>

        {/* Main card */}
        <div className="relative z-10 w-full max-w-[420px]">
          <div className="backdrop-blur-xl bg-white/[0.08] rounded-3xl border border-white/[0.12] shadow-2xl shadow-black/30 overflow-hidden">

            {/* Card header */}
            <div className="px-8 pt-8 pb-6 text-center border-b border-white/[0.06]">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30 mb-4">
                <IconRestaurant className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">{storeName}</h1>
              <p className="text-white/40 text-sm mt-1">{dateStr}</p>
            </div>

            {/* Card body */}
            <div className="px-8 py-6">
              {!selectedEmployee ? (
                <div className="animate-fade-in">
                  <p className="text-white/50 text-sm mb-4">選擇帳號登入</p>

                  <div className="space-y-2">
                    {employees?.map((employee) => {
                      const color = ROLE_COLOR[employee.role] ?? { bg: 'from-gray-500 to-gray-600', text: 'text-gray-100', glow: 'shadow-gray-500/30' };
                      return (
                        <button
                          key={employee.id}
                          onClick={() => setSelectedEmployee(employee)}
                          className="w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.1] hover:border-white/[0.18] transition-all duration-200 active:scale-[0.98] group"
                        >
                          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color.bg} flex items-center justify-center shadow-lg ${color.glow} flex-shrink-0`}>
                            <span className={`text-sm font-bold ${color.text}`}>{employee.name[0]}</span>
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <p className="font-semibold text-white text-[15px] truncate">{employee.name}</p>
                            <p className="text-white/40 text-xs">{ROLE_LABEL[employee.role] || employee.role}</p>
                          </div>
                          <svg className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      );
                    })}
                  </div>

                  {/* Test credentials */}
                  <div className="mt-5 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">PIN 碼</p>
                    <div className="flex justify-around">
                      {[{ n: '管理員', p: '0000' }, { n: '小明', p: '1234' }, { n: '阿華', p: '5678' }].map((x) => (
                        <div key={x.p} className="text-center">
                          <p className="text-[11px] text-white/40">{x.n}</p>
                          <p className="text-sm font-bold text-white/70 font-mono tracking-[0.2em]">{x.p}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="animate-fade-in">
                  {/* Back */}
                  <button
                    onClick={() => { setSelectedEmployee(null); setPin(''); setError(''); }}
                    className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors mb-6"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    返回
                  </button>

                  {/* Selected user */}
                  <div className="text-center mb-6">
                    <UserAvatar name={selectedEmployee.name} size={64} className="mx-auto shadow-xl" />
                    <h3 className="text-xl font-bold text-white mt-3">{selectedEmployee.name}</h3>
                    <p className="text-white/40 text-sm">{ROLE_LABEL[selectedEmployee.role] || selectedEmployee.role}</p>
                  </div>

                  {/* PIN display */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-white/50">請輸入 PIN 碼</p>
                      <button onClick={() => setShowPin(!showPin)} className="text-[11px] text-white/30 hover:text-white/60 transition-colors">
                        {showPin ? '隱藏' : '顯示'}
                      </button>
                    </div>

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

                    <div className="flex gap-5 mb-6 cursor-text justify-center" onClick={() => pinRef.current?.focus()}>
                      {[0, 1, 2, 3].map((i) => {
                        const filled = pin.length > i;
                        const active = pin.length === i;
                        return (
                          <div key={i} className="flex flex-col items-center gap-2 w-12">
                            <div className="h-10 flex items-center justify-center">
                              {filled ? (
                                showPin ? <span className="text-2xl font-bold text-white">{pin[i]}</span>
                                  : <span className="w-3 h-3 rounded-full bg-white" />
                              ) : active ? (
                                <span className="w-0.5 h-7 bg-indigo-400 rounded-full" style={{ animation: 'blink 1s step-end infinite' }} />
                              ) : null}
                            </div>
                            <div className={`w-full h-0.5 rounded-full transition-all duration-200
                              ${error ? 'bg-red-500' : filled ? 'bg-white' : active ? 'bg-indigo-400' : 'bg-white/15'}`} />
                          </div>
                        );
                      })}
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 mb-4 animate-shake">
                        <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm text-red-400">{error}</p>
                      </div>
                    )}

                    <button
                      id="login-btn"
                      onClick={() => void handleLogin()}
                      disabled={pin.length < 4 || isLoading}
                      className="w-full h-12 rounded-xl font-semibold text-base transition-all disabled:cursor-not-allowed bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 active:from-indigo-600 active:to-purple-700 text-white shadow-lg shadow-indigo-500/25 disabled:opacity-40 disabled:shadow-none"
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          登入中...
                        </span>
                      ) : '登入'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom floating info */}
        <div className="absolute bottom-4 left-0 right-0 text-center text-[10px] text-white/20 z-10">
          超星集團 POS v2.0
        </div>
      </div>
    </>
  );
}
