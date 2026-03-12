import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { IconChart, IconDownload } from '../../components/ui/Icons';
import {
  createAnalyticsWorkbookXml,
  getAnalytics,
  type AnalyticsData,
} from '../../services/analyticsService';
import { downloadFile } from '../../services/syncService';
import { useAppSettingsStore } from '../../stores/useAppSettingsStore';
import { formatPrice } from '../../utils/currency';
import {
  formatDate,
  getMonthRange,
  getTodayRange,
  getWeekRange,
} from '../../utils/date';

type Period = 'today' | 'week' | 'month' | 'custom';

interface AnalyticsRange {
  start: Date;
  end: Date;
  label: string;
  fileToken: string;
}

function buildRangeLabel(start: Date, end: Date): string {
  const startLabel = formatDate(start);
  const endLabel = formatDate(end);
  return startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;
}

function buildRangeFileToken(start: Date, end: Date): string {
  const startLabel = format(start, 'yyyyMMdd');
  const endLabel = format(end, 'yyyyMMdd');
  return startLabel === endLabel ? startLabel : `${startLabel}-${endLabel}`;
}

function resolveAnalyticsRange(
  period: Period,
  customStart: string,
  customEnd: string
): AnalyticsRange | null {
  let start: Date;
  let end: Date;

  switch (period) {
    case 'today': {
      const range = getTodayRange();
      start = range.start;
      end = range.end;
      break;
    }
    case 'week': {
      const range = getWeekRange();
      start = range.start;
      end = range.end;
      break;
    }
    case 'month': {
      const range = getMonthRange();
      start = range.start;
      end = range.end;
      break;
    }
    case 'custom': {
      if (!customStart || !customEnd) {
        return null;
      }

      start = new Date(`${customStart}T00:00:00`);
      end = new Date(`${customEnd}T23:59:59`);
      if (start > end) {
        return null;
      }
      break;
    }
    default:
      return null;
  }

  return {
    start,
    end,
    label: buildRangeLabel(start, end),
    fileToken: buildRangeFileToken(start, end),
  };
}

export default function AnalyticsPage() {
  const currency = useAppSettingsStore((state) => state.settings.currency);
  const [period, setPeriod] = useState<Period>('today');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const range = useMemo(
    () => resolveAnalyticsRange(period, customStart, customEnd),
    [period, customStart, customEnd]
  );
  const invalidCustomRange =
    period === 'custom' &&
    customStart !== '' &&
    customEnd !== '' &&
    new Date(`${customStart}T00:00:00`) > new Date(`${customEnd}T00:00:00`);
  const subscribeToDarkMode = useCallback((cb: () => void) => {
    const observer = new MutationObserver(cb);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  const isDark = useSyncExternalStore(
    subscribeToDarkMode,
    () => document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      if (!range) {
        setData(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const result = await getAnalytics(range.start, range.end);
      if (!cancelled) {
        setData(result);
        setLoading(false);
      }
    }

    void fetchData();

    return () => {
      cancelled = true;
    };
  }, [range]);

  const handleExportExcel = () => {
    if (!data || !range) {
      return;
    }

    const workbook = createAnalyticsWorkbookXml({
      data,
      currency,
      rangeLabel: range.label,
    });

    downloadFile(
      workbook,
      `analytics-${range.fileToken}.xls`,
      'application/vnd.ms-excel;charset=utf-8'
    );
    toast.success('Excel 已匯出');
  };

  return (
    <div className="h-full flex flex-col">
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-slate-50 flex items-center gap-2">
            <IconChart className="w-6 h-6 text-indigo-500" />
            營運分析
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
            可查看區間營收、時段銷售、每小時分布，並匯出 Excel。
          </p>
          <div className="flex gap-2 mt-3 flex-wrap items-center">
            {(['today', 'week', 'month', 'custom'] as const).map((value) => (
              <button
                key={value}
                onClick={() => setPeriod(value)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  period === value
                    ? 'bg-indigo-600 text-white shadow-md dark:bg-indigo-500'
                    : 'bg-gray-100 text-gray-500 dark:bg-[#131c2e] dark:text-slate-400'
                }`}
              >
                {value === 'today'
                  ? '今日'
                  : value === 'week'
                    ? '本週'
                    : value === 'month'
                      ? '本月'
                      : '自訂'}
              </button>
            ))}
            {period === 'custom' && (
              <div className="flex gap-2 items-center flex-wrap">
                <input
                  type="date"
                  value={customStart}
                  onChange={(event) => setCustomStart(event.target.value)}
                  className="input-field text-sm py-1.5"
                />
                <span className="text-gray-400">~</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(event) => setCustomEnd(event.target.value)}
                  className="input-field text-sm py-1.5"
                />
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleExportExcel}
          disabled={loading || !data}
          className="btn-secondary flex items-center gap-2 text-sm self-start disabled:opacity-50"
        >
          <IconDownload className="w-4 h-4" />
          匯出 Excel
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="space-y-6 animate-pulse">
            <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map((item) => (
                <div key={item} className="card p-5">
                  <div className="skeleton h-4 w-16 mb-3" />
                  <div className="skeleton h-8 w-28" />
                </div>
              ))}
            </div>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
              <div className="card p-5">
                <div className="skeleton h-4 w-28 mb-4" />
                <div className="skeleton h-72 w-full" />
              </div>
              <div className="card p-5">
                <div className="skeleton h-4 w-24 mb-4" />
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((item) => (
                    <div key={item} className="skeleton h-16 w-full" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : !data ? (
          <div className="text-center py-16 text-gray-400 dark:text-slate-500 animate-fade-in">
            <IconChart className="w-12 h-12 mx-auto mb-3" />
            <p className="text-lg font-medium">
              {invalidCustomRange
                ? '開始日期不能晚於結束日期'
                : period === 'custom'
                  ? '請選擇開始與結束日期'
                  : '請選擇日期範圍'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm text-gray-500 dark:text-slate-400">
                報表區間：{range?.label}
              </p>
              {data.peakTimeSlot && (
                <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                  尖峰時段：{data.peakTimeSlot.label} ({data.peakTimeSlot.hoursLabel})
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
              <div className="card p-5 animate-slide-up stagger-1">
                <p className="text-sm text-gray-500 dark:text-slate-400">總營收</p>
                <p className="text-2xl lg:text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                  {formatPrice(data.totalRevenue)}
                </p>
              </div>
              <div className="card p-5 animate-slide-up stagger-2">
                <p className="text-sm text-gray-500 dark:text-slate-400">總訂單數</p>
                <p className="text-2xl lg:text-3xl font-bold text-gray-800 dark:text-slate-50 mt-1">
                  {data.totalOrders}
                </p>
              </div>
              <div className="card p-5 animate-slide-up stagger-3">
                <p className="text-sm text-gray-500 dark:text-slate-400">平均客單價</p>
                <p className="text-2xl lg:text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {formatPrice(data.averageOrderValue)}
                </p>
              </div>
              <div className="card p-5 animate-slide-up stagger-4">
                <p className="text-sm text-gray-500 dark:text-slate-400">熱銷商品</p>
                <p className="text-xl lg:text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 truncate">
                  {data.topItems[0]?.name || '-'}
                </p>
              </div>
              <div className="card p-5 animate-slide-up stagger-5">
                <p className="text-sm text-gray-500 dark:text-slate-400">尖峰時段</p>
                <p className="text-xl lg:text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                  {data.peakTimeSlot?.label || '-'}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                  {data.peakTimeSlot ? formatPrice(data.peakTimeSlot.revenue) : '尚無資料'}
                </p>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
              <div className="card p-5 animate-slide-up stagger-6">
                <h3 className="font-semibold text-gray-800 dark:text-slate-50 mb-4">
                  時段營收
                </h3>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={data.timeSlotBreakdown}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={isDark ? '#334155' : '#e2e8f0'}
                    />
                    <XAxis
                      dataKey="label"
                      stroke={isDark ? '#64748b' : '#94a3b8'}
                      fontSize={12}
                    />
                    <YAxis
                      stroke={isDark ? '#64748b' : '#94a3b8'}
                      fontSize={12}
                    />
                    <Tooltip
                      formatter={((value: number) => [formatPrice(value), '營收']) as never}
                      labelFormatter={((label: string, payload: Array<{ payload: AnalyticsData['timeSlotBreakdown'][number] }>) => {
                        const entry = payload[0]?.payload;
                        return entry ? `${label} (${entry.hoursLabel})` : label;
                      }) as never}
                      contentStyle={{
                        backgroundColor: isDark ? '#1e293b' : '#fff',
                        border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="revenue" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card p-5 animate-slide-up stagger-6">
                <h3 className="font-semibold text-gray-800 dark:text-slate-50 mb-4">
                  時段摘要
                </h3>
                <div className="space-y-3">
                  {data.timeSlotBreakdown.map((slot) => (
                    <div
                      key={slot.key}
                      className="rounded-xl border border-gray-200 dark:border-[#1e2d4a] px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-gray-800 dark:text-slate-50">
                            {slot.label}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                            {slot.hoursLabel}
                          </p>
                        </div>
                        <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                          {formatPrice(slot.revenue)}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-3 text-sm text-gray-500 dark:text-slate-400">
                        <span>訂單數：{slot.orders}</span>
                        <span>客單價：{formatPrice(slot.averageOrderValue)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {data.revenueByDay.length > 1 && (
              <div className="card p-5 animate-slide-up stagger-6">
                <h3 className="font-semibold text-gray-800 dark:text-slate-50 mb-4">
                  營收趨勢
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.revenueByDay}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={isDark ? '#334155' : '#e2e8f0'}
                    />
                    <XAxis
                      dataKey="date"
                      stroke={isDark ? '#64748b' : '#94a3b8'}
                      fontSize={12}
                    />
                    <YAxis
                      stroke={isDark ? '#64748b' : '#94a3b8'}
                      fontSize={12}
                    />
                    <Tooltip
                      formatter={((value: number) => [formatPrice(value), '營收']) as never}
                      contentStyle={{
                        backgroundColor: isDark ? '#1e293b' : '#fff',
                        border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                        borderRadius: '8px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="card p-5 animate-slide-up stagger-6">
                <h3 className="font-semibold text-gray-800 dark:text-slate-50 mb-4">
                  熱銷排行
                </h3>
                {data.topItems.length === 0 ? (
                  <p className="text-gray-400 dark:text-slate-500 text-center py-8">
                    尚無資料
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={data.topItems} layout="vertical">
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={isDark ? '#334155' : '#e2e8f0'}
                      />
                      <XAxis
                        type="number"
                        stroke={isDark ? '#64748b' : '#94a3b8'}
                        fontSize={12}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={96}
                        stroke={isDark ? '#64748b' : '#94a3b8'}
                        fontSize={12}
                      />
                      <Tooltip
                        formatter={((value: number) => [value, '數量']) as never}
                        contentStyle={{
                          backgroundColor: isDark ? '#1e293b' : '#fff',
                          border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="quantity" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="card p-5 animate-slide-up stagger-6">
                <h3 className="font-semibold text-gray-800 dark:text-slate-50 mb-4">
                  每小時訂單分布
                </h3>
                {data.hourlyBreakdown.length === 0 ? (
                  <p className="text-gray-400 dark:text-slate-500 text-center py-8">
                    尚無資料
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={data.hourlyBreakdown}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={isDark ? '#334155' : '#e2e8f0'}
                      />
                      <XAxis
                        dataKey="hour"
                        stroke={isDark ? '#64748b' : '#94a3b8'}
                        fontSize={12}
                        tickFormatter={(hour: number) => `${hour}:00`}
                      />
                      <YAxis
                        stroke={isDark ? '#64748b' : '#94a3b8'}
                        fontSize={12}
                      />
                      <Tooltip
                        labelFormatter={((hour: number) => `${hour}:00`) as never}
                        formatter={((value: number) => [value, '訂單數']) as never}
                        contentStyle={{
                          backgroundColor: isDark ? '#1e293b' : '#fff',
                          border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="orders" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
