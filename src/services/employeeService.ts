import { api } from '../api/client';
import { db } from '../db/database';
import type { Employee, EmployeeRole } from '../db/types';
import { hashPin } from './authService';

export interface EmployeeInput {
  name: string;
  username: string;
  pin?: string;
  role: EmployeeRole;
  isActive?: boolean;
}

function normalizeEmployee(employee: Employee, existing?: Employee): Employee {
  return {
    ...employee,
    pin: employee.pin || existing?.pin || '***',
  };
}

async function persistEmployee(employee: Employee, existing?: Employee): Promise<Employee> {
  const normalized = normalizeEmployee(employee, existing);
  await db.employees.put(normalized);
  return normalized;
}

export async function saveEmployee(
  employeeId: number | undefined,
  input: EmployeeInput
): Promise<Employee> {
  const existing = typeof employeeId === 'number'
    ? await db.employees.get(employeeId)
    : undefined;

  try {
    const employee = typeof employeeId === 'number'
      ? await api.put<Employee>(`/employees/${employeeId}`, input)
      : await api.post<Employee>('/employees', input);

    return persistEmployee(employee, existing);
  } catch {
    const now = new Date().toISOString();

    if (typeof employeeId === 'number' && existing) {
      const updates: Partial<Employee> = {
        name: input.name,
        username: input.username,
        role: input.role,
        isActive: input.isActive ?? existing.isActive,
      };

      if (input.pin) {
        updates.pin = await hashPin(input.pin);
      }

      await db.employees.update(employeeId, updates);
      return normalizeEmployee({ ...existing, ...updates }, existing);
    }

    const pin = await hashPin(input.pin ?? '');
    const created: Employee = {
      name: input.name,
      username: input.username,
      pin,
      role: input.role,
      isActive: input.isActive ?? true,
      createdAt: now,
    };

    const id = await db.employees.add(created);
    const employee = { ...created, id: id as number };
    await db.employees.put(employee);
    return employee;
  }
}

export async function setEmployeeActive(
  employeeId: number,
  isActive: boolean
): Promise<Employee> {
  const employee = await db.employees.get(employeeId);
  if (!employee) {
    throw new Error('Employee not found');
  }

  return saveEmployee(employeeId, {
    name: employee.name,
    username: employee.username,
    role: employee.role,
    isActive,
  });
}
