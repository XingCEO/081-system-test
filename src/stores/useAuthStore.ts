import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Employee } from '../db/types';

interface AuthState {
  currentEmployee: Employee | null;
  isAuthenticated: boolean;
  shiftId: number | null;
  token: string | null;
  login: (employee: Employee, shiftId: number, token?: string) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      currentEmployee: null,
      isAuthenticated: false,
      shiftId: null,
      token: null,
      login: (employee, shiftId, token) => {
        // Strip pin before persisting to localStorage
        set({ currentEmployee: { ...employee, pin: '' }, isAuthenticated: true, shiftId, token: token ?? null });
      },
      setToken: (token) => set({ token }),
      logout: () =>
        set({ currentEmployee: null, isAuthenticated: false, shiftId: null, token: null }),
    }),
    { name: 'pos-auth' }
  )
);
