import { format, formatDistanceToNow, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, isToday } from 'date-fns';
import { zhTW } from 'date-fns/locale';

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'yyyy/MM/dd HH:mm', { locale: zhTW });
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'yyyy/MM/dd', { locale: zhTW });
}

export function formatTime(date: string | Date): string {
  return format(new Date(date), 'HH:mm', { locale: zhTW });
}

export function formatTimeAgo(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { locale: zhTW, addSuffix: true });
}

export function getMinutesElapsed(date: string | Date): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / 60000);
}

export function getTodayDateString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function getTodayRange(): { start: Date; end: Date } {
  const now = new Date();
  return { start: startOfDay(now), end: endOfDay(now) };
}

export function getWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
}

export function getMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  return { start: startOfMonth(now), end: endOfMonth(now) };
}

export function getDateRange(days: number): { start: Date; end: Date } {
  const now = new Date();
  return { start: startOfDay(subDays(now, days - 1)), end: endOfDay(now) };
}

export function getDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function isTodayDate(date: string | Date): boolean {
  return isToday(new Date(date));
}
