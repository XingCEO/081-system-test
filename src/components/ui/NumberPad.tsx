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
    <div className="grid grid-cols-3 gap-2">
      {keys.map((key) => (
        <button
          key={key}
          onClick={() => handlePress(key)}
          className={`number-pad-btn ${
            key === 'C'
              ? '!bg-red-50 !text-red-600 !border-red-200 hover:!bg-red-100 dark:!bg-red-900/20 dark:!text-red-400 dark:!border-red-800'
              : key === 'BS'
              ? '!bg-amber-50 !text-amber-600 !border-amber-200 hover:!bg-amber-100 dark:!bg-amber-900/20 dark:!text-amber-400 dark:!border-amber-800'
              : ''
          }`}
        >
          {key === 'BS' ? <IconBackspace className="w-6 h-6 mx-auto" /> : key}
        </button>
      ))}
    </div>
  );
}
