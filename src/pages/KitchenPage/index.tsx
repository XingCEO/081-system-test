import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { updateOrderStatus, updateOrderItemStatus } from '../../services/orderService';
import { getMinutesElapsed } from '../../utils/date';
import { getShortOrderNumber } from '../../utils/orderNumber';
import { ORDER_STATUS_LABELS } from '../../utils/constants';
import { IconFire, IconChefHat, IconMapPin, IconNote, IconWarning, IconCheck, IconSparkles } from '../../components/ui/Icons';
import toast from 'react-hot-toast';
import { useAppSettingsStore } from '../../stores/useAppSettingsStore';
import type { Order, OrderItem, OrderStatus } from '../../db/types';

function playDingDong() {
  try {
    const ctx = new AudioContext();
    const resume = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
    resume.then(() => {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.frequency.value = 880;
      osc1.type = 'sine';
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc1.connect(gain1).connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.15);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.frequency.value = 1174;
      osc2.type = 'sine';
      gain2.gain.setValueAtTime(0.3, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc2.connect(gain2).connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.35);

      setTimeout(() => ctx.close(), 500);
    });
  } catch {
    // AudioContext not available
  }
}

function playNotificationSound() {
  const REPEAT = 5;
  const INTERVAL = 450;
  for (let i = 0; i < REPEAT; i++) {
    setTimeout(playDingDong, i * INTERVAL);
  }
}

export default function KitchenPage() {
  const [muted, setMuted] = useState(false);
  const enableSound = useAppSettingsStore((s) => s.settings.enableSound);
  const knownOrderIdsRef = useRef<Set<number> | null>(null);
  const data = useLiveQuery(async () => {
    const orders = await db.orders.where('status').anyOf(['pending', 'preparing', 'ready']).toArray();
    const map = new Map<number, OrderItem[]>();
    for (const order of orders) {
      if (!order.id) continue;
      map.set(order.id, await db.orderItems.where('orderId').equals(order.id).toArray());
    }
    return { orders, orderItems: map };
  });
  const activeOrders = data?.orders;
  const orderItems = data?.orderItems;

  // Play sound when new pending orders arrive
  useEffect(() => {
    if (!activeOrders) return;
    const currentIds = new Set(activeOrders.filter(o => o.status === 'pending').map(o => o.id!));

    if (knownOrderIdsRef.current === null) {
      // First load — just record, don't play
      knownOrderIdsRef.current = currentIds;
      return;
    }

    const hasNew = [...currentIds].some(id => !knownOrderIdsRef.current!.has(id));
    if (hasNew && !muted && enableSound) {
      playNotificationSound();
    }
    knownOrderIdsRef.current = currentIds;
  }, [activeOrders, muted, enableSound]);

  const handleStatusChange = async (order: Order, newStatus: OrderStatus) => {
    if (!order.id) return;
    try {
      await updateOrderStatus(order.id, newStatus);
      const label = ORDER_STATUS_LABELS[newStatus];
      toast.success(`訂單 ${order.orderNumber} → ${label}`);
    } catch {
      toast.error('更新訂單狀態失敗');
    }
  };

  const handleItemToggle = async (item: OrderItem) => {
    if (!item.id) return;
    try {
      const newStatus = item.itemStatus === 'completed' ? 'pending' : 'completed';
      await updateOrderItemStatus(item.id, newStatus);
    } catch {
      toast.error('更新品項狀態失敗');
    }
  };

  const pending = activeOrders?.filter(o => o.status === 'pending') || [];
  const preparing = activeOrders?.filter(o => o.status === 'preparing') || [];
  const ready = activeOrders?.filter(o => o.status === 'ready') || [];

  const renderOrderCard = (order: Order, i: number) => {
    const items = orderItems?.get(order.id!) || [];
    const minutes = getMinutesElapsed(order.createdAt);
    const isUrgent = minutes >= 15;

    const completedCount = items.filter(it => it.itemStatus === 'completed').length;
    const totalCount = items.length;

    const borderColor =
      order.status === 'pending' ? 'border-red-400 bg-red-50 dark:bg-red-950/50 dark:border-red-600' :
      order.status === 'preparing' ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/50 dark:border-amber-600' :
      'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 dark:border-emerald-600';

    const statusColor =
      order.status === 'pending' ? 'bg-red-500' :
      order.status === 'preparing' ? 'bg-amber-500' :
      'bg-emerald-500';

    return (
      <div key={order.id} className={`rounded-xl border-2 ${borderColor} overflow-hidden animate-slide-up stagger-${Math.min(i + 1, 6)} transition-all hover:shadow-lg`}>
        {/* Card Header */}
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${statusColor} ${order.status === 'pending' ? 'animate-pulse' : ''}`} />
            <span className="font-bold text-lg dark:text-slate-50">#{getShortOrderNumber(order.orderNumber)}</span>
          </div>
          <div className="flex items-center gap-2">
            {totalCount > 0 && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                completedCount === totalCount
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400'
                  : 'bg-gray-100 text-gray-500 dark:bg-[#131c2e] dark:text-slate-400'
              }`}>
                {completedCount}/{totalCount} 完成
              </span>
            )}
            {order.tableName !== '外帶' && (
              <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400 px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-0.5">
                <IconMapPin className="w-3 h-3" /> {order.tableName}
              </span>
            )}
            <span className={`text-sm font-medium ${isUrgent ? 'text-red-600 dark:text-red-400 animate-pulse' : 'text-gray-500 dark:text-slate-400'}`}>
              {minutes} 分鐘
            </span>
          </div>
        </div>

        {/* Items with per-item toggle */}
        <div className="px-4 pb-3 space-y-1">
          {items.map((item) => {
            const isDone = item.itemStatus === 'completed';
            return (
              <button
                key={item.id}
                onClick={() => handleItemToggle(item)}
                className={`w-full flex items-center gap-2 text-left rounded-lg px-2 py-1.5 min-h-[48px] transition-all ${
                  isDone
                    ? 'bg-emerald-100/50 dark:bg-emerald-900/20'
                    : 'hover:bg-white/50 dark:hover:bg-white/5'
                }`}
              >
                <span className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                  isDone
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-gray-300 dark:border-[#2a3a54]'
                }`}>
                  {isDone && <IconCheck className="w-3 h-3" />}
                </span>
                <span className={`font-bold min-w-[24px] ${isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                  {item.quantity}x
                </span>
                <div className="flex-1 min-w-0">
                  <span className={`font-medium ${isDone ? 'line-through text-gray-400 dark:text-slate-500' : 'text-gray-800 dark:text-slate-50'}`}>
                    {item.productName}
                  </span>
                  {item.isCombo && item.comboItems && item.comboItems.length > 0 && (
                    <div className="mt-0.5 ml-2 space-y-0.5">
                      {item.comboItems.map((sub, si) => (
                        <p key={si} className={`text-xs ${isDone ? 'text-gray-400 dark:text-slate-500 line-through' : 'text-gray-500 dark:text-slate-400'}`}>
                          └ {sub.quantity}x {sub.productName}
                        </p>
                      ))}
                    </div>
                  )}
                  {item.modifiers?.length > 0 && (
                    <span className={`text-xs ml-1 ${isDone ? 'text-gray-400 dark:text-slate-500' : 'text-gray-500 dark:text-slate-400'}`}>
                      ({item.modifiers.map(m => m.name).join(', ')})
                    </span>
                  )}
                  {item.note && (
                    <p className={`text-xs flex items-center gap-0.5 ${isDone ? 'text-gray-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      <IconNote className="w-3 h-3" /> {item.note}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
          {order.note && (
            <p className="text-sm text-amber-600 dark:text-amber-400 font-medium mt-2 flex items-center gap-1">
              <IconWarning className="w-4 h-4" /> {order.note}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="px-4 pb-3">
          {order.status === 'pending' && (
            <button
              onClick={() => handleStatusChange(order, 'preparing')}
              className="btn-warning w-full flex items-center justify-center gap-1.5"
            >
              <IconChefHat className="w-4 h-4" /> 開始製作
            </button>
          )}
          {order.status === 'preparing' && (
            <button
              onClick={() => handleStatusChange(order, 'ready')}
              className="btn-success w-full flex items-center justify-center gap-1.5"
            >
              <IconCheck className="w-4 h-4" /> 製作完成
            </button>
          )}
          {order.status === 'ready' && (
            <button
              onClick={() => handleStatusChange(order, 'completed')}
              className="btn-primary w-full flex items-center justify-center gap-1.5"
            >
              <IconSparkles className="w-4 h-4" /> 已出餐
            </button>
          )}
        </div>
      </div>
    );
  };

  const noOrders = !activeOrders?.length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-slate-50 flex items-center gap-2">
            <IconFire className="w-6 h-6 text-orange-500" /> 廚房顯示
          </h1>
          <div className="flex gap-4 mt-1 text-sm">
            <span className="text-red-600 dark:text-red-400 font-medium">待處理：{pending.length}</span>
            <span className="text-amber-600 dark:text-amber-400 font-medium">製作中：{preparing.length}</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">完成：{ready.length}</span>
          </div>
        </div>
        <button
          onClick={() => setMuted(!muted)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border-2 ${
            muted || !enableSound
              ? 'bg-gray-200 text-gray-500 dark:bg-[#1e2d4a] dark:text-slate-400 border-red-400'
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 border-emerald-400'
          }`}
          title={!enableSound ? '系統設定已關閉提示音' : ''}
        >
          {!enableSound ? '🔇 音效已關閉' : muted ? '🔇 已靜音' : '🔔 提示音開'}
        </button>
      </div>

      {noOrders ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-slate-500">
          <div className="text-center animate-fade-in">
            <IconChefHat className="w-16 h-16 mx-auto mb-4" />
            <p className="text-xl font-medium">目前沒有訂單</p>
            <p className="text-sm mt-1.5">新訂單將自動顯示在此</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pending.map((o, i) => renderOrderCard(o, i))}
            {preparing.map((o, i) => renderOrderCard(o, i + pending.length))}
            {ready.map((o, i) => renderOrderCard(o, i + pending.length + preparing.length))}
          </div>
        </div>
      )}
    </div>
  );
}
