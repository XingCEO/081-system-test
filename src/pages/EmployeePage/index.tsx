import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { hashPin } from '../../services/authService';
import { useAppSettingsStore } from '../../stores/useAppSettingsStore';
import { formatPrice } from '../../utils/currency';
import { formatDateTime } from '../../utils/date';
import { ROLE_LABELS } from '../../utils/constants';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { IconUsers } from '../../components/ui/Icons';
import toast from 'react-hot-toast';
import type { Employee, EmployeeRole } from '../../db/types';

export default function EmployeePage() {
  useAppSettingsStore((state) => state.settings.currency);
  const [showForm, setShowForm] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [shiftEmployeeId, setShiftEmployeeId] = useState<number | null>(null);

  const employees = useLiveQuery(() => db.employees.toArray());
  const shifts = useLiveQuery(
    () => shiftEmployeeId ? db.shifts.where('employeeId').equals(shiftEmployeeId).reverse().limit(20).toArray() : [],
    [shiftEmployeeId]
  );

  const handleSave = async (data: { name: string; username: string; pin: string; role: EmployeeRole }) => {
    if (editEmployee?.id) {
      const updates: Partial<Employee> = { name: data.name, username: data.username, role: data.role };
      if (data.pin) {
        updates.pin = await hashPin(data.pin);
      }
      await db.employees.update(editEmployee.id, updates);
      toast.success('員工已更新');
    } else {
      const pinHash = await hashPin(data.pin);
      await db.employees.add({
        ...data,
        pin: pinHash,
        isActive: true,
        createdAt: new Date().toISOString(),
      });
      toast.success('員工已新增');
    }
    setShowForm(false);
    setEditEmployee(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    await db.employees.update(deleteTarget.id, { isActive: false });
    setDeleteTarget(null);
    toast.success('員工已停用');
  };

  const handleToggleActive = async (emp: Employee) => {
    if (!emp.id) return;
    await db.employees.update(emp.id, { isActive: !emp.isActive });
    toast.success(emp.isActive ? '已停用' : '已啟用');
  };

  return (
    <div className="h-full flex flex-col">
      <div className="page-header flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><IconUsers className="w-6 h-6 text-blue-500" /> 員工管理</h1>
        <button onClick={() => { setEditEmployee(null); setShowForm(true); }} className="btn-primary text-sm">+ 新增員工</button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {!employees?.length ? (
          <div className="text-center py-16 text-slate-400 dark:text-slate-600 animate-fade-in">
            <IconUsers className="w-12 h-12 mx-auto mb-3" />
            <p className="text-lg font-medium">尚無員工資料</p>
          </div>
        ) : (
          <div className="space-y-2">
            {employees.map((emp, i) => (
              <div key={emp.id} className={`card px-4 py-3 flex items-center justify-between ${!emp.isActive ? 'opacity-50' : ''} animate-slide-up stagger-${Math.min(i + 1, 6)}`}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center shadow-sm">
                    <span className="text-xl font-bold text-white">{emp.name.charAt(0)}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">{emp.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm text-slate-500 dark:text-slate-400">@{emp.username}</span>
                      <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400 px-2 py-0.5 rounded-full text-xs font-medium">
                        {ROLE_LABELS[emp.role]}
                      </span>
                      {!emp.isActive && (
                        <span className="bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400 px-2 py-0.5 rounded-full text-xs font-medium">已停用</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShiftEmployeeId(emp.id!)} className="btn-secondary text-sm px-3 py-1.5">班次記錄</button>
                  <button onClick={() => { setEditEmployee(emp); setShowForm(true); }} className="btn-secondary text-sm px-3 py-1.5">編輯</button>
                  <button onClick={() => handleToggleActive(emp)} className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${emp.isActive ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950' : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950'}`}>
                    {emp.isActive ? '停用' : '啟用'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Employee Form */}
      {showForm && (
        <EmployeeFormModal
          employee={editEmployee}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditEmployee(null); }}
        />
      )}

      {/* Shift History */}
      {shiftEmployeeId && (
        <Modal open={true} onClose={() => setShiftEmployeeId(null)} title="班次記錄" size="lg">
          <div className="space-y-2">
            {shifts?.length === 0 ? (
              <p className="text-center text-slate-400 dark:text-slate-600 py-8">尚無班次記錄</p>
            ) : (
              shifts?.map((shift) => (
                <div key={shift.id} className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">{formatDateTime(shift.startTime)}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {shift.endTime ? `下班：${formatDateTime(shift.endTime)}` : '尚未下班'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900 dark:text-white">訂單：{shift.totalOrders}</p>
                    <p className="text-sm text-blue-600 dark:text-blue-400">{formatPrice(shift.totalRevenue)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="停用員工"
        message={`確定要停用「${deleteTarget?.name}」？`}
        confirmText="停用"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function EmployeeFormModal({ employee, onSave, onClose }: {
  employee: Employee | null;
  onSave: (data: { name: string; username: string; pin: string; role: EmployeeRole }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(employee?.name || '');
  const [username, setUsername] = useState(employee?.username || '');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState<EmployeeRole>(employee?.role || 'cashier');

  return (
    <Modal open={true} onClose={onClose} title={employee ? '編輯員工' : '新增員工'} size="sm">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">姓名 *</label>
          <input value={name} onChange={e => setName(e.target.value)} className="input-field" placeholder="員工姓名" />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">帳號 *</label>
          <input value={username} onChange={e => setUsername(e.target.value)} className="input-field" placeholder="登入帳號" />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">{employee ? 'PIN碼 (留空不修改)' : 'PIN碼 *'}</label>
          <input value={pin} onChange={e => setPin(e.target.value)} className="input-field" type="password" placeholder="4位數PIN碼" maxLength={4} />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">角色</label>
          <div className="flex gap-2">
            {(['admin', 'cashier', 'kitchen'] as const).map(r => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-all ${role === r ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400' : 'border-slate-200 dark:border-slate-700 dark:text-slate-400'}`}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">取消</button>
          <button
            onClick={() => name && username && (employee || pin) && onSave({ name, username, pin, role })}
            disabled={!name || !username || (!employee && !pin)}
            className="btn-primary flex-1"
          >
            {employee ? '更新' : '新增'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
