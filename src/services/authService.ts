import { api } from '../api/client';
import { db } from '../db/database';
import type { Employee, EmployeeRole } from '../db/types';

export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPin(
  employee: Employee,
  inputPin: string
): Promise<boolean> {
  const inputHash = await hashPin(inputPin);
  return employee.pin === inputHash;
}

export async function loginEmployee(
  employeeId: number,
  pin: string
): Promise<{ employee: Employee; shiftId: number } | null> {
  try {
    const result = await api.post<{ employee: Employee; shiftId: number } | null>(
      '/auth/login',
      { employeeId, pin }
    );

    if (!result) return null;

    // Update Dexie locally for immediate reactivity
    if (result.employee) {
      await db.employees.put(result.employee);
    }
    if (result.shiftId) {
      await db.shifts.put({
        id: result.shiftId,
        employeeId: result.employee.id!,
        employeeName: result.employee.name,
        startTime: new Date().toISOString(),
        endTime: '',
        totalOrders: 0,
        totalRevenue: 0,
      });
    }

    return result;
  } catch {
    // Fallback to Dexie-only if server is unavailable.
    // PIN hashes are not stored locally for security, so offline login
    // only works if the employee record still has a valid pin hash
    // (e.g., was created locally before any sync).
    const employee = await db.employees.get(employeeId);
    if (!employee || !employee.isActive) return null;

    // If pin is empty (synced from server without hash), reject login
    if (!employee.pin || employee.pin === '') {
      throw new Error('伺服器離線，無法驗證登入');
    }

    const valid = await verifyPin(employee, pin);
    if (!valid) return null;

    const shiftId = await db.shifts.add({
      employeeId: employee.id!,
      employeeName: employee.name,
      startTime: new Date().toISOString(),
      endTime: '',
      totalOrders: 0,
      totalRevenue: 0,
    });

    return { employee, shiftId: shiftId as number };
  }
}

export async function logoutEmployee(shiftId: number): Promise<void> {
  try {
    await api.post('/auth/logout', { shiftId });
  } catch {
    // Fallback to Dexie-only
    const shift = await db.shifts.get(shiftId);
    if (!shift) return;

    const orders = await db.orders
      .where('employeeId')
      .equals(shift.employeeId)
      .filter(
        (o) =>
          o.createdAt >= shift.startTime &&
          o.status === 'completed'
      )
      .toArray();

    await db.shifts.update(shiftId, {
      endTime: new Date().toISOString(),
      totalOrders: orders.length,
      totalRevenue: orders.reduce((sum, o) => sum + o.total, 0),
    });
  }
}

const PERMISSIONS: Record<EmployeeRole, string[]> = {
  admin: [
    'pos', 'tables', 'kitchen', 'orders', 'menu',
    'inventory', 'employees', 'analytics', 'settings',
  ],
  cashier: ['pos', 'tables', 'orders'],
  kitchen: ['kitchen'],
};

export function hasPermission(role: EmployeeRole, page: string): boolean {
  return PERMISSIONS[role]?.includes(page) ?? false;
}

export function getDefaultRoute(role: EmployeeRole): string {
  switch (role) {
    case 'admin':
      return '/pos';
    case 'cashier':
      return '/pos';
    case 'kitchen':
      return '/kitchen';
    default:
      return '/pos';
  }
}
