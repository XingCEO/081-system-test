import { describe, expect, it } from 'vitest';
import {
  buildTimeSlotBreakdown,
  createAnalyticsWorkbookXml,
  type AnalyticsData,
} from './analyticsService';

describe('analyticsService', () => {
  it('groups completed orders into named time slots', () => {
    // Use ISO strings without offset so getHours() works in any timezone
    const breakdown = buildTimeSlotBreakdown([
      { createdAt: '2026-03-08T08:15:00', total: 120 },
      { createdAt: '2026-03-08T12:20:00', total: 220 },
      { createdAt: '2026-03-08T12:50:00', total: 180 },
      { createdAt: '2026-03-08T15:10:00', total: 90 },
      { createdAt: '2026-03-08T18:05:00', total: 260 },
      { createdAt: '2026-03-08T22:40:00', total: 150 },
    ]);

    expect(breakdown).toEqual([
      expect.objectContaining({ key: 'breakfast', orders: 1, revenue: 120, averageOrderValue: 120 }),
      expect.objectContaining({ key: 'lunch', orders: 2, revenue: 400, averageOrderValue: 200 }),
      expect.objectContaining({ key: 'afternoon', orders: 1, revenue: 90, averageOrderValue: 90 }),
      expect.objectContaining({ key: 'dinner', orders: 1, revenue: 260, averageOrderValue: 260 }),
      expect.objectContaining({ key: 'lateNight', orders: 1, revenue: 150, averageOrderValue: 150 }),
    ]);
  });

  it('builds an Excel-compatible workbook with summary and time slot sheets', () => {
    const data: AnalyticsData = {
      totalRevenue: 1020,
      totalCost: 400,
      grossProfit: 620,
      grossMarginPercent: 60.8,
      totalOrders: 6,
      averageOrderValue: 170,
      topItems: [
        { name: '雞腿飯', quantity: 3, revenue: 390 },
      ],
      revenueByDay: [
        { date: '03/08', orders: 6, revenue: 1020 },
      ],
      hourlyBreakdown: [
        { hour: 8, orders: 1, revenue: 120 },
        { hour: 12, orders: 2, revenue: 400 },
      ],
      timeSlotBreakdown: buildTimeSlotBreakdown([
        { createdAt: '2026-03-08T08:15:00', total: 120 },
        { createdAt: '2026-03-08T12:20:00', total: 220 },
        { createdAt: '2026-03-08T12:50:00', total: 180 },
        { createdAt: '2026-03-08T15:10:00', total: 90 },
        { createdAt: '2026-03-08T18:05:00', total: 260 },
        { createdAt: '2026-03-08T22:40:00', total: 150 },
      ]),
      peakTimeSlot: {
        key: 'lunch',
        label: '午餐',
        hoursLabel: '11:00-14:59',
        orders: 2,
        revenue: 400,
        averageOrderValue: 200,
      },
    };

    const workbook = createAnalyticsWorkbookXml({
      data,
      currency: 'NT$',
      rangeLabel: '2026/03/08',
      generatedAt: new Date('2026-03-08T12:00:00'),
    });

    expect(workbook).toContain('Worksheet ss:Name="摘要"');
    expect(workbook).toContain('Worksheet ss:Name="時段分析"');
    expect(workbook).toContain('午餐');
    expect(workbook).toContain('雞腿飯');
    expect(workbook).toContain('2026/03/08');
  });
});
