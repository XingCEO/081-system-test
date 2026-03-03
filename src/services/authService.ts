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
  const employee = await db.employees.get(employeeId);
  if (!employee || !employee.isActive) return null;

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

export async function logoutEmployee(shiftId: number): Promise<void> {
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
