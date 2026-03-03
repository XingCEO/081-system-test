import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { useCartStore } from '../../stores/useCartStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { TABLE_STATUS_LABELS, TABLE_STATUS_COLORS } from '../../utils/constants';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { IconCart, IconBroom, IconCheck, IconCalendar, IconTrash, IconPencilSquare } from '../../components/ui/Icons';
import toast from 'react-hot-toast';
import type { RestaurantTable, TableShape, TableStatus } from '../../db/types';

type ViewMode = 'canvas' | 'list';

export default function TableMapPage() {
  const navigate = useNavigate();
  const { currentEmployee } = useAuthStore();
  const isAdmin = currentEmployee?.role === 'admin';
  const [editMode, setEditMode] = useState(false);
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [showAddTable, setShowAddTable] = useState(false);
  const [dragTable, setDragTable] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [viewMode, setViewMode] = useState<ViewMode>('canvas');
  const [deleteTarget, setDeleteTarget] = useState<RestaurantTable | null>(null);

  const tables = useLiveQuery(() => db.diningTables.filter(t => t.isActive).toArray());

  const handleTableClick = (table: RestaurantTable) => {
    if (editMode) return;
    setSelectedTable(table);
  };

  const handleStartOrder = (table: RestaurantTable) => {
    useCartStore.getState().setTable(table.id!, `${table.number} ${table.name}`);
    setSelectedTable(null);
    navigate('/pos');
  };

  const handleStatusChange = async (table: RestaurantTable, status: TableStatus) => {
    if (!table.id) return;
    await db.diningTables.update(table.id, { status, currentOrderId: status === 'available' ? null : table.currentOrderId });
    setSelectedTable(null);
    toast.success(`${table.number} 已設為${TABLE_STATUS_LABELS[status]}`);
  };

  const handleDragStart = (e: React.MouseEvent, table: RestaurantTable) => {
    if (!editMode || !table.id) return;
    const rect = (e.target as HTMLElement).closest('.table-item')?.getBoundingClientRect();
    if (!rect) return;
    setDragTable(table.id);
    setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleDragMove = (e: React.MouseEvent) => {
    if (!dragTable || !editMode) return;
    const container = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, e.clientX - container.left - dragOffset.x);
    const y = Math.max(0, e.clientY - container.top - dragOffset.y);
    db.diningTables.update(dragTable, { x: Math.round(x), y: Math.round(y) });
  };

  const handleDragEnd = () => {
    setDragTable(null);
  };

  const handleAddTable = async (data: { number: string; name: string; capacity: number; shape: TableShape }) => {
    await db.diningTables.add({
      ...data,
      x: 50 + Math.random() * 300,
      y: 50 + Math.random() * 300,
      width: data.shape === 'rectangle' ? 140 : 100,
      height: 100,
      status: 'available',
      currentOrderId: null,
      floor: 1,
      isActive: true,
    });
    setShowAddTable(false);
    toast.success('桌位已新增');
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget?.id) return;
    await db.diningTables.delete(deleteTarget.id);
    setDeleteTarget(null);
    toast.success('桌位已刪除');
  };

  const statusCounts = {
    available: tables?.filter(t => t.status === 'available').length || 0,
    occupied: tables?.filter(t => t.status === 'occupied').length || 0,
    cleaning: tables?.filter(t => t.status === 'cleaning').length || 0,
    reserved: tables?.filter(t => t.status === 'reserved').length || 0,
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">桌位管理</h1>
          <div className="flex gap-4 mt-1">
            {Object.entries(statusCounts).map(([status, count]) => (
              <span key={status} className="text-sm text-slate-500 dark:text-slate-400">
                {TABLE_STATUS_LABELS[status]}：<span className="font-semibold">{count}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {/* View Mode Toggle */}
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <button
              onClick={() => setViewMode('canvas')}
              className={`px-3 py-1.5 text-sm font-medium transition-all ${
                viewMode === 'canvas'
                  ? 'bg-blue-600 text-white dark:bg-blue-500'
                  : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
              }`}
            >
              畫布
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-sm font-medium transition-all ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white dark:bg-blue-500'
                  : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
              }`}
            >
              列表
            </button>
          </div>
          {isAdmin && (
            <>
              {editMode && (
                <button onClick={() => setShowAddTable(true)} className="btn-secondary">
                  + 新增桌位
                </button>
              )}
              <button
                onClick={() => setEditMode(!editMode)}
                className={editMode ? 'btn-primary' : 'btn-secondary'}
              >
                {editMode ? <><IconCheck className="w-4 h-4 inline" /> 完成編輯</> : <><IconPencilSquare className="w-4 h-4 inline" /> 編輯佈局</>}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Canvas View */}
      {viewMode === 'canvas' && (
        <div
          className="flex-1 relative overflow-auto bg-slate-100 dark:bg-slate-950 p-4"
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
        >
          <div className="relative min-w-[700px] min-h-[600px]">
            {tables?.map((table) => (
              <div
                key={table.id}
                className={`table-item absolute cursor-pointer transition-all hover:shadow-lg flex flex-col items-center justify-center text-center select-none ${
                  TABLE_STATUS_COLORS[table.status]
                } ${editMode ? 'cursor-move ring-2 ring-dashed ring-blue-300 dark:ring-blue-600' : ''} ${
                  table.shape === 'round' ? 'rounded-full' : 'rounded-xl'
                }`}
                style={{
                  left: table.x,
                  top: table.y,
                  width: table.width,
                  height: table.height,
                }}
                onClick={() => handleTableClick(table)}
                onMouseDown={(e) => handleDragStart(e, table)}
              >
                {/* Delete button in edit mode */}
                {editMode && isAdmin && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(table); }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-md z-10 transition-colors"
                  >
                    ✕
                  </button>
                )}
                <span className="font-bold text-lg">{table.number}</span>
                <span className="text-xs opacity-75">{table.name}</span>
                <span className="text-xs opacity-60 mt-0.5">{table.capacity}人</span>
                <span className="text-[10px] font-medium mt-1">
                  {TABLE_STATUS_LABELS[table.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-2">
            {tables?.map((table, i) => (
              <div
                key={table.id}
                className={`card px-4 py-3 flex items-center justify-between animate-slide-up stagger-${Math.min(i + 1, 6)}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg ${TABLE_STATUS_COLORS[table.status]}`}>
                    {table.number}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                      {table.number} {table.name}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {table.capacity} 人座 · {table.shape === 'square' ? '方形' : table.shape === 'round' ? '圓形' : '長方形'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${TABLE_STATUS_COLORS[table.status]}`}>
                    {TABLE_STATUS_LABELS[table.status]}
                  </span>
                  {!editMode && (
                    <button
                      onClick={() => handleTableClick(table)}
                      className="btn-secondary text-sm px-3 py-1.5"
                    >
                      操作
                    </button>
                  )}
                  {editMode && isAdmin && (
                    <button
                      onClick={() => setDeleteTarget(table)}
                      className="btn-danger text-sm px-3 py-1.5 flex items-center gap-1"
                    >
                      <IconTrash className="w-3.5 h-3.5" /> 刪除
                    </button>
                  )}
                </div>
              </div>
            ))}
            {(!tables || tables.length === 0) && (
              <div className="text-center py-16 text-slate-400 dark:text-slate-600">
                <p className="text-lg font-medium">尚無桌位</p>
                <p className="text-sm mt-1">請切換至編輯模式新增桌位</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table Action Modal */}
      {selectedTable && !editMode && (
        <Modal
          open={true}
          onClose={() => setSelectedTable(null)}
          title={`${selectedTable.number} ${selectedTable.name}`}
          size="sm"
        >
          <div className="space-y-3">
            <div className="text-center mb-4">
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                TABLE_STATUS_COLORS[selectedTable.status]
              }`}>
                {TABLE_STATUS_LABELS[selectedTable.status]}
              </span>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">容納 {selectedTable.capacity} 人</p>
            </div>

            {selectedTable.status === 'available' && (
              <button
                onClick={() => handleStartOrder(selectedTable)}
                className="btn-primary w-full py-3 flex items-center justify-center gap-1.5"
              >
                <IconCart className="w-4 h-4" /> 開始點餐
              </button>
            )}

            {selectedTable.status === 'occupied' && (
              <>
                <button
                  onClick={() => handleStartOrder(selectedTable)}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-1.5"
                >
                  <IconCart className="w-4 h-4" /> 繼續點餐 / 加點
                </button>
                <button
                  onClick={() => handleStatusChange(selectedTable, 'cleaning')}
                  className="btn-warning w-full flex items-center justify-center gap-1.5"
                >
                  <IconBroom className="w-4 h-4" /> 標記待清理
                </button>
              </>
            )}

            {selectedTable.status === 'cleaning' && (
              <button
                onClick={() => handleStatusChange(selectedTable, 'available')}
                className="btn-success w-full py-3 flex items-center justify-center gap-1.5"
              >
                <IconCheck className="w-4 h-4" /> 設為空桌
              </button>
            )}

            {selectedTable.status === 'reserved' && (
              <button
                onClick={() => handleStatusChange(selectedTable, 'available')}
                className="btn-secondary w-full"
              >
                取消預約
              </button>
            )}

            {selectedTable.status === 'available' && (
              <button
                onClick={() => handleStatusChange(selectedTable, 'reserved')}
                className="btn-secondary w-full flex items-center justify-center gap-1.5"
              >
                <IconCalendar className="w-4 h-4" /> 設為預約
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="刪除桌位"
        message={`確定要永久刪除「${deleteTarget?.number} ${deleteTarget?.name}」？此操作無法復原。`}
        confirmText="刪除"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Add Table Modal */}
      {showAddTable && (
        <AddTableModal
          onClose={() => setShowAddTable(false)}
          onAdd={handleAddTable}
        />
      )}
    </div>
  );
}

function AddTableModal({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (data: { number: string; name: string; capacity: number; shape: TableShape }) => void;
}) {
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState(4);
  const [shape, setShape] = useState<TableShape>('square');

  return (
    <Modal open={true} onClose={onClose} title="新增桌位" size="sm">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">桌號</label>
          <input value={number} onChange={e => setNumber(e.target.value)} className="input-field" placeholder="例：A1" />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">名稱</label>
          <input value={name} onChange={e => setName(e.target.value)} className="input-field" placeholder="例：窗邊座位" />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">容納人數</label>
          <input type="number" value={capacity} onChange={e => setCapacity(+e.target.value)} className="input-field" min={1} max={20} />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">形狀</label>
          <div className="flex gap-2">
            {(['square', 'round', 'rectangle'] as const).map(s => (
              <button
                key={s}
                onClick={() => setShape(s)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-all ${shape === s ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400' : 'border-slate-200 dark:border-slate-700 dark:text-slate-400'}`}
              >
                {s === 'square' ? '方形' : s === 'round' ? '圓形' : '長方形'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">取消</button>
          <button onClick={() => number && onAdd({ number, name, capacity, shape })} className="btn-primary flex-1" disabled={!number}>新增</button>
        </div>
      </div>
    </Modal>
  );
}
