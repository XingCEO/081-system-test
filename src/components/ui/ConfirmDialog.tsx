import Modal from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '確認',
  cancelText = '取消',
  variant = 'info',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const btnClass = variant === 'danger' ? 'btn-danger' : variant === 'warning' ? 'btn-warning' : 'btn-primary';

  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      <p className="text-slate-600 dark:text-slate-400 mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button onClick={onCancel} className="btn-secondary">
          {cancelText}
        </button>
        <button onClick={onConfirm} className={btnClass}>
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}
