import { db } from '../db/database';
import { format, eachDayOfInterval } from 'date-fns';
import type { DailySummary } from '../db/types';

export interface AnalyticsData {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  topItems: { name: string; quantity: number; revenue: number }[];
  revenueByDay: { date: string; revenue: number; orders: number }[];
  hourlyBreakdown: { hour: number; orders: number; revenue: number }[];
}

export async function getAnalytics(
  startDate: Date,
  endDate: Date
): Promise<AnalyticsData> {
  const orders = await db.orders
    .where('createdAt')
    .between(startDate.toISOString(), endDate.toISOString(), true, true)
    .filter((o) => o.status === 'completed')
    .toArray();

  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const totalOrders = orders.length;
  const averageOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

  // Top items
  const itemMap = new Map<string, { quantity: number; revenue: number }>();
  for (const order of orders) {
    if (!order.id) continue;
    const items = await db.orderItems.where('orderId').equals(order.id).toArray();
    for (const item of items) {
      const existing = itemMap.get(item.productName) || { quantity: 0, revenue: 0 };
      existing.quantity += item.quantity;
      existing.revenue += item.subtotal;
      itemMap.set(item.productName, existing);
    }
  }

  const topItems = Array.from(itemMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  // Revenue by day
  const dayMap = new Map<string, { revenue: number; orders: number }>();
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  for (const day of days) {
    dayMap.set(format(day, 'MM/dd'), { revenue: 0, orders: 0 });
  }
  for (const order of orders) {
    const key = format(new Date(order.createdAt), 'MM/dd');
    const existing = dayMap.get(key) || { revenue: 0, orders: 0 };
    existing.revenue += order.total;
    existing.orders += 1;
    dayMap.set(key, existing);
  }

  const revenueByDay = Array.from(dayMap.entries()).map(([date, data]) => ({
    date,
    ...data,
  }));

  // Hourly breakdown
  const hourMap = new Map<number, { orders: number; revenue: number }>();
  for (let h = 0; h < 24; h++) {
    hourMap.set(h, { orders: 0, revenue: 0 });
  }
  for (const order of orders) {
    const hour = new Date(order.createdAt).getHours();
    const existing = hourMap.get(hour)!;
    existing.orders += 1;
    existing.revenue += order.total;
  }

  const hourlyBreakdown = Array.from(hourMap.entries())
    .map(([hour, data]) => ({ hour, ...data }))
    .filter((h) => h.hour >= 6 && h.hour <= 23);

  return {
    totalRevenue,
    totalOrders,
    averageOrderValue,
    topItems,
    revenueByDay,
    hourlyBreakdown,
  };
}

export async function generateDailySummary(date: string): Promise<DailySummary> {
  const dayStart = new Date(date + 'T00:00:00');
  const dayEnd = new Date(date + 'T23:59:59');

  const analytics = await getAnalytics(dayStart, dayEnd);

  const summary: DailySummary = {
    date,
    totalOrders: analytics.totalOrders,
    totalRevenue: analytics.totalRevenue,
    totalDiscount: 0,
    averageOrderValue: analytics.averageOrderValue,
    topSellingItems: analytics.topItems.map((item) => ({
      productId: 0,
      name: item.name,
      quantity: item.quantity,
    })),
    hourlyBreakdown: analytics.hourlyBreakdown,
    createdAt: new Date().toISOString(),
  };

  const existing = await db.dailySummaries.where('date').equals(date).first();
  if (existing && existing.id) {
    await db.dailySummaries.put({ ...summary, id: existing.id });
  } else {
    await db.dailySummaries.add(summary);
  }

  return summary;
}
