import { IconBackspace } from './Icons';

interface NumberPadProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}

export default function NumberPad({ value, onChange, maxLength = 10 }: NumberPadProps) {
  const handlePress = (key: string) => {
    if (key === 'C') {
      onChange('');
    } else if (key === 'BS') {
      onChange(value.slice(0, -1));
    } else if (value.length < maxLength) {
      onChange(value + key);
    }
  };

  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'C', '0', 'BS'];

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {keys.map((key) => (
        <button
          key={key}
          onClick={() => handlePress(key)}
          className={`number-pad-btn rounded-2xl backdrop-blur-sm transition-all duration-200 active:scale-95 ${
            key === 'C'
              ? 'bg-red-100/60 text-red-600 border border-red-200/50 hover:bg-red-100 hover:shadow-md dark:bg-red-500/[0.08] dark:text-red-400 dark:border-red-400/[0.12] dark:hover:bg-red-500/[0.15] active:bg-red-200 dark:active:bg-red-500/[0.2]'
              : key === 'BS'
              ? 'bg-amber-100/60 text-amber-600 border border-amber-200/50 hover:bg-amber-100 hover:shadow-md dark:bg-amber-500/[0.08] dark:text-amber-400 dark:border-amber-400/[0.12] dark:hover:bg-amber-500/[0.15] active:bg-amber-200 dark:active:bg-amber-500/[0.2]'
              : 'bg-white/60 text-slate-700 border border-slate-200/50 hover:bg-white hover:shadow-md dark:bg-white/[0.06] dark:text-slate-200 dark:border-white/[0.08] dark:hover:bg-white/[0.12] active:bg-slate-100 dark:active:bg-white/[0.16]'
          }`}
        >
          {key === 'BS' ? <IconBackspace className="w-6 h-6 mx-auto" /> : key}
        </button>
      ))}
    </div>
  );
}
