import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Employee } from '../db/types';

interface AuthState {
  currentEmployee: Employee | null;
  isAuthenticated: boolean;
  shiftId: number | null;
  login: (employee: Employee, shiftId: number) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      currentEmployee: null,
      isAuthenticated: false,
      shiftId: null,
      login: (employee, shiftId) =>
        set({ currentEmployee: employee, isAuthenticated: true, shiftId }),
      logout: () =>
        set({ currentEmployee: null, isAuthenticated: false, shiftId: null }),
    }),
    { name: 'pos-auth' }
  )
);
