import { describe, expect, it } from 'vitest';
import type { EmployeeRole } from '../db/types';
import { getDefaultRoute, hasPermission, hashPin } from './authService';

describe('authService.hashPin', () => {
  it('相同輸入應產生一致的 SHA-256 hash', async () => {
    const hash1 = await hashPin('1234');
    const hash2 = await hashPin('1234');
    expect(hash1).toBe(hash2);
  });

  it('不同輸入應產生不同的 hash', async () => {
    const hash1 = await hashPin('1234');
    const hash2 = await hashPin('5678');
    expect(hash1).not.toBe(hash2);
  });

  it('hash 長度應為 64 個十六進位字元（SHA-256）', async () => {
    const hash = await hashPin('0000');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('空字串不應拋出錯誤，且產生固定 hash', async () => {
    const hash = await hashPin('');
    expect(hash).toHaveLength(64);
  });
});

describe('authService.hasPermission', () => {
  it('admin 可存取所有頁面', () => {
    const adminPages = ['pos', 'tables', 'kitchen', 'orders', 'menu', 'inventory', 'employees', 'analytics', 'settings'];
    for (const page of adminPages) {
      expect(hasPermission('admin', page)).toBe(true);
    }
  });

  it('cashier 只能存取 pos、tables、orders', () => {
    expect(hasPermission('cashier', 'pos')).toBe(true);
    expect(hasPermission('cashier', 'tables')).toBe(true);
    expect(hasPermission('cashier', 'orders')).toBe(true);

    expect(hasPermission('cashier', 'kitchen')).toBe(false);
    expect(hasPermission('cashier', 'menu')).toBe(false);
    expect(hasPermission('cashier', 'inventory')).toBe(false);
    expect(hasPermission('cashier', 'employees')).toBe(false);
    expect(hasPermission('cashier', 'analytics')).toBe(false);
    expect(hasPermission('cashier', 'settings')).toBe(false);
  });

  it('kitchen 只能存取 kitchen', () => {
    expect(hasPermission('kitchen', 'kitchen')).toBe(true);

    expect(hasPermission('kitchen', 'pos')).toBe(false);
    expect(hasPermission('kitchen', 'tables')).toBe(false);
    expect(hasPermission('kitchen', 'orders')).toBe(false);
    expect(hasPermission('kitchen', 'menu')).toBe(false);
    expect(hasPermission('kitchen', 'inventory')).toBe(false);
  });

  it('無效頁面名稱應回傳 false', () => {
    const roles: EmployeeRole[] = ['admin', 'cashier', 'kitchen'];
    for (const role of roles) {
      expect(hasPermission(role, 'nonexistent-page')).toBe(false);
    }
  });
});

describe('authService.getDefaultRoute', () => {
  it('admin 預設路由為 /pos', () => {
    expect(getDefaultRoute('admin')).toBe('/pos');
  });

  it('cashier 預設路由為 /pos', () => {
    expect(getDefaultRoute('cashier')).toBe('/pos');
  });

  it('kitchen 預設路由為 /kitchen', () => {
    expect(getDefaultRoute('kitchen')).toBe('/kitchen');
  });
});
