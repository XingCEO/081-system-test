import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import {
  IconDownload,
  IconReceipt,
  IconSave,
  IconSettings,
  IconStorefront,
  IconTrash,
  IconUpload,
  IconWarning,
  IconWrench,
} from '../../components/ui/Icons';
import {
  downloadFile,
  exportAllData,
  importAllData,
  resetAllData,
} from '../../services/syncService';
import type { AppSettings } from '../../services/settingsService';
import { useAppSettingsStore } from '../../stores/useAppSettingsStore';
import { useThemeStore } from '../../stores/useThemeStore';

const THEME_COLOR_PRESETS = ['#1e40af', '#0f766e', '#b45309', '#be123c', '#334155'];

export default function SettingsPage() {
  const settings = useAppSettingsStore((state) => state.settings);
  const hydrated = useAppSettingsStore((state) => state.hydrated);
  const saveSettings = useAppSettingsStore((state) => state.saveSettings);
  const { theme, setTheme } = useThemeStore();
  const [formValues, setFormValues] = useState<AppSettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (hydrated) {
      setFormValues(settings);
    }
  }, [hydrated, settings]);

  const orderPreview = useMemo(() => {
    const date = format(new Date(), 'yyyyMMdd');
    return formValues.orderNumberPrefix
      ? `${formValues.orderNumberPrefix}-${date}-001`
      : `${date}-001`;
  }, [formValues.orderNumberPrefix]);

  const updateField = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setFormValues((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      await saveSettings(formValues);
      toast.success('設定已儲存');
    } catch {
      toast.error('設定儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async () => {
    const data = await exportAllData();
    downloadFile(data, `pos-backup-${new Date().toISOString().slice(0, 10)}.json`);
    toast.success('備份已匯出');
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      await importAllData(text);
      toast.success('資料已匯入，系統將重新整理');
      window.setTimeout(() => window.location.reload(), 1200);
    } catch {
      toast.error('匯入失敗，請確認備份格式');
    }

    if (importRef.current) {
      importRef.current.value = '';
    }
  };

  if (!hydrated) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-slate-500 dark:text-slate-400">讀取設定中...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-2">
          <IconSettings className="w-6 h-6 text-slate-500 dark:text-slate-400" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">系統設定</h1>
        </div>

        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">外觀模式</h2>
          <div className="grid grid-cols-3 gap-3">
            {(['light', 'dark', 'system'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setTheme(mode)}
                className={`py-3 rounded-xl text-sm font-medium border-2 transition-all ${
                  theme === mode
                    ? 'border-slate-900 bg-slate-100 text-slate-900 dark:border-slate-200 dark:bg-slate-800 dark:text-white'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                {mode === 'light' ? '亮色' : mode === 'dark' ? '深色' : '跟隨系統'}
              </button>
            ))}
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <IconStorefront className="w-5 h-5" />
            店家資訊
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">店家名稱</label>
              <input
                value={formValues.storeName}
                onChange={(event) => updateField('storeName', event.target.value)}
                className="input-field"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">店家地址</label>
              <input
                value={formValues.storeAddress}
                onChange={(event) => updateField('storeAddress', event.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">店家電話</label>
              <input
                value={formValues.storePhone}
                onChange={(event) => updateField('storePhone', event.target.value)}
                className="input-field"
              />
            </div>
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <IconReceipt className="w-5 h-5" />
            收據與編號
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">收據標頭</label>
              <input
                value={formValues.receiptHeader}
                onChange={(event) => updateField('receiptHeader', event.target.value)}
                className="input-field"
                placeholder="例如：統一編號 12345678"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">收據頁尾</label>
              <input
                value={formValues.receiptFooter}
                onChange={(event) => updateField('receiptFooter', event.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">貨幣符號</label>
              <input
                value={formValues.currency}
                onChange={(event) => updateField('currency', event.target.value)}
                className="input-field"
                placeholder="NT$"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">訂單編號前綴</label>
              <input
                value={formValues.orderNumberPrefix}
                onChange={(event) => updateField('orderNumberPrefix', event.target.value)}
                className="input-field"
                placeholder="例如：POS"
              />
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">預覽：{orderPreview}</p>
            </div>
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <IconWrench className="w-5 h-5" />
            一般設定
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">自動登出分鐘</label>
              <input
                type="number"
                min={5}
                max={240}
                value={formValues.autoLogoutMinutes}
                onChange={(event) => updateField('autoLogoutMinutes', Number(event.target.value) || 0)}
                className="input-field"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-1">低庫存預設門檻</label>
              <input
                type="number"
                min={1}
                value={formValues.lowStockDefaultThreshold}
                onChange={(event) => updateField('lowStockDefaultThreshold', Number(event.target.value) || 0)}
                className="input-field"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 block mb-2">主題色</label>
              <div className="flex flex-wrap gap-3 mb-3">
                {THEME_COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => updateField('themeColor', color)}
                    className={`w-10 h-10 rounded-full border-4 transition-transform ${
                      formValues.themeColor === color
                        ? 'border-slate-900 dark:border-white scale-105'
                        : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="flex gap-3">
                <input
                  type="color"
                  value={formValues.themeColor}
                  onChange={(event) => updateField('themeColor', event.target.value)}
                  className="h-11 w-16 rounded-lg cursor-pointer border border-slate-200 dark:border-slate-700"
                />
                <input
                  value={formValues.themeColor}
                  onChange={(event) => updateField('themeColor', event.target.value)}
                  className="input-field"
                />
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">儲存後會立即套用到主要按鈕、導覽與登入畫面。</p>
            </div>
            <label className="md:col-span-2 flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3">
              <input
                type="checkbox"
                checked={formValues.enableSound}
                onChange={(event) => updateField('enableSound', event.target.checked)}
                className="w-5 h-5 rounded"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">啟用提示音</span>
            </label>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="btn-primary w-full py-3 text-lg flex items-center justify-center gap-2"
        >
          <IconSave className="w-5 h-5" />
          {isSaving ? '儲存中...' : '儲存設定'}
        </button>

        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <IconSave className="w-5 h-5" />
            資料管理
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={handleExport} className="btn-secondary py-3 flex items-center justify-center gap-1.5">
              <IconUpload className="w-4 h-4" /> 匯出備份
            </button>
            <button onClick={() => importRef.current?.click()} className="btn-secondary py-3 flex items-center justify-center gap-1.5">
              <IconDownload className="w-4 h-4" /> 匯入備份
            </button>
            <input ref={importRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          </div>
        </div>

        <div className="card p-6 border-red-200 dark:border-red-900 space-y-4">
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
            <IconWarning className="w-5 h-5" />
            危險操作
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            這會清除本機所有資料，包含菜單、訂單、員工、庫存與設定。
          </p>
          <button onClick={() => setShowReset(true)} className="btn-danger flex items-center gap-1.5">
            <IconTrash className="w-4 h-4" /> 重設系統資料
          </button>
        </div>

        <ConfirmDialog
          open={showReset}
          title="重設系統資料"
          message="確定要清除所有本機資料嗎？此操作無法復原。"
          confirmText="確認重設"
          variant="danger"
          onConfirm={() => {
            void resetAllData();
          }}
          onCancel={() => setShowReset(false)}
        />
      </div>
    </div>
  );
}
