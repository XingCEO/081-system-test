import { useState, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { exportAllData, importAllData, resetAllData, downloadFile } from '../../services/syncService';
import { useThemeStore } from '../../stores/useThemeStore';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { IconSettings, IconStorefront, IconReceipt, IconWrench, IconSave, IconUpload, IconDownload, IconWarning, IconTrash } from '../../components/ui/Icons';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const settings = useLiveQuery(() => db.settings.toArray());
  const [overrides, setOverrides] = useState<Record<string, unknown>>({});
  const [showReset, setShowReset] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const { theme, setTheme } = useThemeStore();

  const values = useMemo(() => {
    const map: Record<string, unknown> = {};
    if (settings) {
      for (const s of settings) map[s.key] = s.value;
    }
    return { ...map, ...overrides };
  }, [settings, overrides]);

  const updateSetting = (key: string, value: unknown) => {
    setOverrides((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    for (const [key, value] of Object.entries(values)) {
      await db.settings.put({ key, value });
    }
    toast.success('設定已儲存！');
  };

  const handleExport = async () => {
    const data = await exportAllData();
    downloadFile(data, `pos-backup-${new Date().toISOString().slice(0, 10)}.json`);
    toast.success('資料已匯出');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      await importAllData(text);
      toast.success('資料匯入成功！頁面將重新載入');
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      toast.error('匯入失敗，請檢查檔案格式');
    }
    if (importRef.current) importRef.current.value = '';
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><IconSettings className="w-6 h-6 text-slate-500 dark:text-slate-400" /> 系統設定</h1>

        {/* Theme */}
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
            外觀主題
          </h2>
          <div className="flex gap-3">
            {(['light', 'dark', 'system'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`flex-1 py-3 rounded-xl text-sm font-medium border-2 transition-all ${
                  theme === t
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                    : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 dark:text-slate-400'
                }`}
              >
                {t === 'light' ? '淺色' : t === 'dark' ? '深色' : '跟隨系統'}
              </button>
            ))}
          </div>
        </div>

        {/* Store Info */}
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2"><IconStorefront className="w-5 h-5" /> 店家資訊</h2>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">店家名稱</label>
            <input value={(values.storeName as string) || ''} onChange={e => updateSetting('storeName', e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">地址</label>
            <input value={(values.storeAddress as string) || ''} onChange={e => updateSetting('storeAddress', e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">電話</label>
            <input value={(values.storePhone as string) || ''} onChange={e => updateSetting('storePhone', e.target.value)} className="input-field" />
          </div>
        </div>

        {/* Receipt */}
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2"><IconReceipt className="w-5 h-5" /> 收據設定</h2>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">收據標頭（額外文字）</label>
            <input value={(values.receiptHeader as string) || ''} onChange={e => updateSetting('receiptHeader', e.target.value)} className="input-field" placeholder="例：統一編號12345678" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">收據頁尾</label>
            <input value={(values.receiptFooter as string) || ''} onChange={e => updateSetting('receiptFooter', e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">貨幣符號</label>
            <input value={(values.currency as string) || 'NT$'} onChange={e => updateSetting('currency', e.target.value)} className="input-field" />
          </div>
        </div>

        {/* General */}
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2"><IconWrench className="w-5 h-5" /> 一般設定</h2>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">自動登出時間 (分鐘)</label>
            <input type="number" value={(values.autoLogoutMinutes as number) || 30} onChange={e => updateSetting('autoLogoutMinutes', +e.target.value)} className="input-field" min={5} max={120} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">低庫存預設閾值</label>
            <input type="number" value={(values.lowStockDefaultThreshold as number) || 10} onChange={e => updateSetting('lowStockDefaultThreshold', +e.target.value)} className="input-field" min={1} />
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="enableSound" checked={(values.enableSound as boolean) ?? true} onChange={e => updateSetting('enableSound', e.target.checked)} className="w-5 h-5 rounded" />
            <label htmlFor="enableSound" className="text-sm font-medium text-slate-700 dark:text-slate-300">啟用音效提醒</label>
          </div>
        </div>

        <button onClick={handleSave} className="btn-primary w-full py-3 text-lg flex items-center justify-center gap-2">
          <IconSave className="w-5 h-5" /> 儲存所有設定
        </button>

        {/* Data Management */}
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2"><IconSave className="w-5 h-5" /> 資料管理</h2>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={handleExport} className="btn-secondary py-3 flex items-center justify-center gap-1.5">
              <IconUpload className="w-4 h-4" /> 匯出所有資料
            </button>
            <button onClick={() => importRef.current?.click()} className="btn-secondary py-3 flex items-center justify-center gap-1.5">
              <IconDownload className="w-4 h-4" /> 匯入資料
            </button>
            <input ref={importRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          </div>
        </div>

        {/* Danger Zone */}
        <div className="card p-6 border-red-200 dark:border-red-900 space-y-4">
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 flex items-center gap-2"><IconWarning className="w-5 h-5" /> 危險區域</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">重置將清除所有資料，包括訂單、菜單、員工等。此操作無法復原。</p>
          <button onClick={() => setShowReset(true)} className="btn-danger flex items-center gap-1.5">
            <IconTrash className="w-4 h-4" /> 重置所有資料
          </button>
        </div>

        <ConfirmDialog
          open={showReset}
          title="重置所有資料"
          message="確定要重置所有資料？此操作無法復原，建議先匯出備份。"
          confirmText="確定重置"
          variant="danger"
          onConfirm={() => resetAllData()}
          onCancel={() => setShowReset(false)}
        />
      </div>
    </div>
  );
}
