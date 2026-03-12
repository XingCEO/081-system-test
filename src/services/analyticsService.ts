import { eachDayOfInterval, format } from 'date-fns';
import { api } from '../api/client';
import { db } from '../db/database';
import type { DailySummary } from '../db/types';

export interface AnalyticsTopItem {
  name: string;
  quantity: number;
  revenue: number;
}

export interface RevenueByDayPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface HourlyBreakdownPoint {
  hour: number;
  orders: number;
  revenue: number;
}

export interface TimeSlotBreakdownPoint {
  key: string;
  label: string;
  hoursLabel: string;
  orders: number;
  revenue: number;
  averageOrderValue: number;
}

export interface AnalyticsData {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  topItems: AnalyticsTopItem[];
  revenueByDay: RevenueByDayPoint[];
  hourlyBreakdown: HourlyBreakdownPoint[];
  timeSlotBreakdown: TimeSlotBreakdownPoint[];
  peakTimeSlot: TimeSlotBreakdownPoint | null;
}

export interface AnalyticsWorkbookParams {
  data: AnalyticsData;
  currency: string;
  rangeLabel: string;
  generatedAt?: Date;
}

interface AnalyticsOrderLike {
  createdAt: string;
  total: number;
}

interface TimeSlotDefinition {
  key: string;
  label: string;
  hoursLabel: string;
  includesHour: (hour: number) => boolean;
}

interface WorksheetDefinition {
  name: string;
  rows: Array<Array<number | string>>;
}

const TIME_SLOT_DEFINITIONS: TimeSlotDefinition[] = [
  {
    key: 'breakfast',
    label: '早餐',
    hoursLabel: '06:00-10:59',
    includesHour: (hour) => hour >= 6 && hour < 11,
  },
  {
    key: 'lunch',
    label: '午餐',
    hoursLabel: '11:00-14:59',
    includesHour: (hour) => hour >= 11 && hour < 15,
  },
  {
    key: 'afternoon',
    label: '下午茶',
    hoursLabel: '15:00-16:59',
    includesHour: (hour) => hour >= 15 && hour < 17,
  },
  {
    key: 'dinner',
    label: '晚餐',
    hoursLabel: '17:00-20:59',
    includesHour: (hour) => hour >= 17 && hour < 21,
  },
  {
    key: 'lateNight',
    label: '宵夜',
    hoursLabel: '21:00-05:59',
    includesHour: (hour) => hour >= 21 || hour < 6,
  },
];

function buildTopItems(
  orderItemsByOrder: Array<Array<{ productName: string; quantity: number; subtotal: number }>>
): AnalyticsTopItem[] {
  const itemMap = new Map<string, { quantity: number; revenue: number }>();

  orderItemsByOrder.forEach((items) => {
    items.forEach((item) => {
      const current = itemMap.get(item.productName) ?? { quantity: 0, revenue: 0 };
      current.quantity += item.quantity;
      current.revenue += item.subtotal;
      itemMap.set(item.productName, current);
    });
  });

  return Array.from(itemMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((left, right) => right.quantity - left.quantity || right.revenue - left.revenue)
    .slice(0, 10);
}

function buildRevenueByDay(orders: AnalyticsOrderLike[], startDate: Date, endDate: Date): RevenueByDayPoint[] {
  const dayMap = new Map<string, { revenue: number; orders: number }>();

  eachDayOfInterval({ start: startDate, end: endDate }).forEach((day) => {
    dayMap.set(format(day, 'MM/dd'), { revenue: 0, orders: 0 });
  });

  orders.forEach((order) => {
    const key = format(new Date(order.createdAt), 'MM/dd');
    const current = dayMap.get(key) ?? { revenue: 0, orders: 0 };
    current.revenue += order.total;
    current.orders += 1;
    dayMap.set(key, current);
  });

  return Array.from(dayMap.entries()).map(([date, data]) => ({
    date,
    ...data,
  }));
}

function buildHourlyBreakdown(orders: AnalyticsOrderLike[]): HourlyBreakdownPoint[] {
  const hourMap = new Map<number, { orders: number; revenue: number }>();

  for (let hour = 0; hour < 24; hour += 1) {
    hourMap.set(hour, { orders: 0, revenue: 0 });
  }

  orders.forEach((order) => {
    const hour = new Date(order.createdAt).getHours();
    const current = hourMap.get(hour);
    if (!current) {
      return;
    }

    current.orders += 1;
    current.revenue += order.total;
  });

  return Array.from(hourMap.entries())
    .map(([hour, data]) => ({ hour, ...data }))
    .filter((entry) => entry.hour >= 6 && entry.hour <= 23);
}

export function buildTimeSlotBreakdown(orders: AnalyticsOrderLike[]): TimeSlotBreakdownPoint[] {
  const slotMap = new Map<string, { orders: number; revenue: number }>();

  TIME_SLOT_DEFINITIONS.forEach((slot) => {
    slotMap.set(slot.key, { orders: 0, revenue: 0 });
  });

  orders.forEach((order) => {
    const hour = new Date(order.createdAt).getHours();
    const slot = TIME_SLOT_DEFINITIONS.find((definition) => definition.includesHour(hour));
    if (!slot) {
      return;
    }

    const current = slotMap.get(slot.key);
    if (!current) {
      return;
    }

    current.orders += 1;
    current.revenue += order.total;
  });

  return TIME_SLOT_DEFINITIONS.map((slot) => {
    const current = slotMap.get(slot.key) ?? { orders: 0, revenue: 0 };
    return {
      key: slot.key,
      label: slot.label,
      hoursLabel: slot.hoursLabel,
      orders: current.orders,
      revenue: current.revenue,
      averageOrderValue: current.orders > 0 ? Math.round(current.revenue / current.orders) : 0,
    };
  });
}

function buildTimeSlotBreakdownFromHourlyBreakdown(
  hourlyBreakdown: HourlyBreakdownPoint[]
): TimeSlotBreakdownPoint[] {
  const slotMap = new Map<string, { orders: number; revenue: number }>();

  TIME_SLOT_DEFINITIONS.forEach((slot) => {
    slotMap.set(slot.key, { orders: 0, revenue: 0 });
  });

  hourlyBreakdown.forEach((entry) => {
    const slot = TIME_SLOT_DEFINITIONS.find((definition) => definition.includesHour(entry.hour));
    if (!slot) {
      return;
    }

    const current = slotMap.get(slot.key);
    if (!current) {
      return;
    }

    current.orders += entry.orders;
    current.revenue += entry.revenue;
  });

  return TIME_SLOT_DEFINITIONS.map((slot) => {
    const current = slotMap.get(slot.key) ?? { orders: 0, revenue: 0 };
    return {
      key: slot.key,
      label: slot.label,
      hoursLabel: slot.hoursLabel,
      orders: current.orders,
      revenue: current.revenue,
      averageOrderValue: current.orders > 0 ? Math.round(current.revenue / current.orders) : 0,
    };
  });
}

function getPeakTimeSlot(timeSlotBreakdown: TimeSlotBreakdownPoint[]): TimeSlotBreakdownPoint | null {
  return timeSlotBreakdown.reduce<TimeSlotBreakdownPoint | null>((best, current) => {
    if (!best) {
      return current.orders > 0 ? current : null;
    }

    if (current.revenue > best.revenue) {
      return current;
    }

    if (current.revenue === best.revenue && current.orders > best.orders) {
      return current;
    }

    return best;
  }, null);
}

export async function getAnalytics(startDate: Date, endDate: Date): Promise<AnalyticsData> {
  try {
    const response = await api.get<{
      totalRevenue: number;
      totalOrders: number;
      averageOrderValue: number;
      topItems: Array<{ name: string; quantity: number; revenue: number }>;
      revenueByDay: Array<{ date: string; revenue: number; orders: number }>;
      hourlyBreakdown: Array<{ hour: number; orders: number; revenue: number }>;
    }>(`/analytics?start=${encodeURIComponent(startDate.toISOString())}&end=${encodeURIComponent(endDate.toISOString())}`);

    const revenueByDay = response.revenueByDay.map((entry) => ({
      date: entry.date.slice(5).replace('-', '/'),
      revenue: entry.revenue,
      orders: entry.orders,
    }));
    const hourlyBreakdown = [...response.hourlyBreakdown].sort((left, right) => left.hour - right.hour);
    const timeSlotBreakdown = buildTimeSlotBreakdownFromHourlyBreakdown(hourlyBreakdown);

    return {
      totalRevenue: response.totalRevenue,
      totalOrders: response.totalOrders,
      averageOrderValue: Math.round(response.averageOrderValue),
      topItems: response.topItems,
      revenueByDay,
      hourlyBreakdown,
      timeSlotBreakdown,
      peakTimeSlot: getPeakTimeSlot(timeSlotBreakdown),
    };
  } catch {
    const orders = await db.orders
      .where('createdAt')
      .between(startDate.toISOString(), endDate.toISOString(), true, true)
      .filter((order) => order.status === 'completed')
      .toArray();

    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    const orderItemsByOrder = await Promise.all(
      orders
        .filter((order): order is typeof order & { id: number } => typeof order.id === 'number')
        .map((order) => db.orderItems.where('orderId').equals(order.id).toArray())
    );

    const topItems = buildTopItems(orderItemsByOrder);
    const revenueByDay = buildRevenueByDay(orders, startDate, endDate);
    const hourlyBreakdown = buildHourlyBreakdown(orders);
    const timeSlotBreakdown = buildTimeSlotBreakdown(orders);

    return {
      totalRevenue,
      totalOrders,
      averageOrderValue,
      topItems,
      revenueByDay,
      hourlyBreakdown,
      timeSlotBreakdown,
      peakTimeSlot: getPeakTimeSlot(timeSlotBreakdown),
    };
  }
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function buildCell(value: number | string): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
  }

  return `<Cell><Data ss:Type="String">${escapeXml(String(value))}</Data></Cell>`;
}

function buildWorksheet(sheet: WorksheetDefinition): string {
  const rows = sheet.rows
    .map((row, index) => {
      const style = index === 0 ? ' ss:StyleID="Header"' : '';
      return `<Row${style}>${row.map((cell) => buildCell(cell)).join('')}</Row>`;
    })
    .join('');

  return `<Worksheet ss:Name="${escapeXml(sheet.name)}"><Table>${rows}</Table></Worksheet>`;
}

function buildWorkbookXml(sheets: WorksheetDefinition[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
<Styles>
  <Style ss:ID="Header">
    <Font ss:Bold="1" />
    <Interior ss:Color="#dbeafe" ss:Pattern="Solid" />
  </Style>
</Styles>
${sheets.map((sheet) => buildWorksheet(sheet)).join('')}
</Workbook>`;
}

export function createAnalyticsWorkbookXml({
  data,
  currency,
  rangeLabel,
  generatedAt = new Date(),
}: AnalyticsWorkbookParams): string {
  const sheets: WorksheetDefinition[] = [
    {
      name: '摘要',
      rows: [
        ['欄位', '數值'],
        ['報表區間', rangeLabel],
        ['匯出時間', format(generatedAt, 'yyyy/MM/dd HH:mm')],
        ['總營收', data.totalRevenue],
        ['總訂單數', data.totalOrders],
        ['平均客單價', data.averageOrderValue],
        ['貨幣符號', currency],
        ['尖峰時段', data.peakTimeSlot ? `${data.peakTimeSlot.label} (${data.peakTimeSlot.hoursLabel})` : '-'],
      ],
    },
    {
      name: '時段分析',
      rows: [
        ['時段', '時間範圍', '訂單數', '營收', '平均客單價'],
        ...data.timeSlotBreakdown.map((slot) => [
          slot.label,
          slot.hoursLabel,
          slot.orders,
          slot.revenue,
          slot.averageOrderValue,
        ]),
      ],
    },
    {
      name: '每日營收',
      rows: [
        ['日期', '訂單數', '營收'],
        ...data.revenueByDay.map((entry) => [entry.date, entry.orders, entry.revenue]),
      ],
    },
    {
      name: '每小時分析',
      rows: [
        ['小時', '訂單數', '營收'],
        ...data.hourlyBreakdown.map((entry) => [`${entry.hour}:00`, entry.orders, entry.revenue]),
      ],
    },
    {
      name: '熱銷商品',
      rows: [
        ['商品', '數量', '營收'],
        ...data.topItems.map((item) => [item.name, item.quantity, item.revenue]),
      ],
    },
  ];

  return buildWorkbookXml(sheets);
}

export async function generateDailySummary(date: string): Promise<DailySummary> {
  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${date}T23:59:59`);
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
  if (existing?.id) {
    await db.dailySummaries.put({ ...summary, id: existing.id });
  } else {
    await db.dailySummaries.add(summary);
  }

  return summary;
}
