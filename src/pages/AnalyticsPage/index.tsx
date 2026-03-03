import { useState, useEffect } from 'react';
import { getAnalytics, type AnalyticsData } from '../../services/analyticsService';
import { getTodayRange, getWeekRange, getMonthRange } from '../../utils/date';
import { formatPrice } from '../../utils/currency';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { IconChart } from '../../components/ui/Icons';

type Period = 'today' | 'week' | 'month' | 'custom';

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('today');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      let range: { start: Date; end: Date };
      switch (period) {
        case 'today': range = getTodayRange(); break;
        case 'week': range = getWeekRange(); break;
        case 'month': range = getMonthRange(); break;
        case 'custom':
          if (!customStart || !customEnd) { setLoading(false); return; }
          range = { start: new Date(customStart), end: new Date(customEnd + 'T23:59:59') };
          break;
        default: range = getTodayRange();
      }
      const result = await getAnalytics(range.start, range.end);
      if (!cancelled) {
        setData(result);
        setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [period, customStart, customEnd]);

  const isDark = document.documentElement.classList.contains('dark');

  return (
    <div className="h-full flex flex-col">
      <div className="page-header">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><IconChart className="w-6 h-6 text-blue-500" /> 營運分析</h1>
        <div className="flex gap-2 mt-3 flex-wrap items-center">
          {(['today', 'week', 'month', 'custom'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${period === p ? 'bg-blue-600 text-white shadow-md dark:bg-blue-500' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}
            >
              {p === 'today' ? '今日' : p === 'week' ? '本週' : p === 'month' ? '本月' : '自訂'}
            </button>
          ))}
          {period === 'custom' && (
            <div className="flex gap-2 items-center">
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="input-field text-sm py-1.5" />
              <span className="text-slate-400">~</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="input-field text-sm py-1.5" />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="space-y-6 animate-pulse">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="card p-5">
                  <div className="skeleton h-4 w-16 mb-3" />
                  <div className="skeleton h-8 w-28" />
                </div>
              ))}
            </div>
            <div className="card p-5">
              <div className="skeleton h-4 w-24 mb-4" />
              <div className="skeleton h-64 w-full" />
            </div>
          </div>
        ) : !data ? (
          <div className="text-center py-16 text-slate-400 dark:text-slate-600 animate-fade-in">
            <IconChart className="w-12 h-12 mx-auto mb-3" />
            <p className="text-lg font-medium">請選擇日期範圍</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card p-5 animate-slide-up stagger-1">
                <p className="text-sm text-slate-500 dark:text-slate-400">總營收</p>
                <p className="text-2xl lg:text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">{formatPrice(data.totalRevenue)}</p>
              </div>
              <div className="card p-5 animate-slide-up stagger-2">
                <p className="text-sm text-slate-500 dark:text-slate-400">總訂單數</p>
                <p className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white mt-1">{data.totalOrders}</p>
              </div>
              <div className="card p-5 animate-slide-up stagger-3">
                <p className="text-sm text-slate-500 dark:text-slate-400">平均客單價</p>
                <p className="text-2xl lg:text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{formatPrice(data.averageOrderValue)}</p>
              </div>
              <div className="card p-5 animate-slide-up stagger-4">
                <p className="text-sm text-slate-500 dark:text-slate-400">熱銷商品</p>
                <p className="text-xl lg:text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 truncate">{data.topItems[0]?.name || '-'}</p>
              </div>
            </div>

            {/* Revenue Chart */}
            {data.revenueByDay.length > 1 && (
              <div className="card p-5 animate-slide-up stagger-5">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-4">營收趨勢</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.revenueByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
                    <XAxis dataKey="date" stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={12} />
                    <YAxis stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={12} />
                    <Tooltip
                      formatter={((value: number) => [`NT$${value.toLocaleString()}`, '營收']) as never}
                      contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', border: isDark ? '1px solid #334155' : '1px solid #e2e8f0', borderRadius: '8px' }}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Items */}
              <div className="card p-5 animate-slide-up stagger-6">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-4">熱銷排行</h3>
                {data.topItems.length === 0 ? (
                  <p className="text-slate-400 dark:text-slate-600 text-center py-8">尚無資料</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.topItems} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
                      <XAxis type="number" stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={12} />
                      <YAxis type="category" dataKey="name" width={80} stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={12} />
                      <Tooltip
                        formatter={((value: number) => [value, '數量']) as never}
                        contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', border: isDark ? '1px solid #334155' : '1px solid #e2e8f0', borderRadius: '8px' }}
                      />
                      <Bar dataKey="quantity" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Hourly Breakdown */}
              <div className="card p-5 animate-slide-up stagger-6">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-4">時段分析</h3>
                {data.hourlyBreakdown.length === 0 ? (
                  <p className="text-slate-400 dark:text-slate-600 text-center py-8">尚無資料</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.hourlyBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
                      <XAxis dataKey="hour" stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={12} tickFormatter={(h: number) => `${h}:00`} />
                      <YAxis stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={12} />
                      <Tooltip
                        labelFormatter={((h: number) => `${h}:00`) as never}
                        formatter={((value: number) => [value, '訂單數']) as never}
                        contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', border: isDark ? '1px solid #334155' : '1px solid #e2e8f0', borderRadius: '8px' }}
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
