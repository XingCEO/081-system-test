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
              ? 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-400 dark:hover:bg-red-900'
              : key === 'BS'
              ? 'bg-amber-100 text-amber-600 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-400 dark:hover:bg-amber-900'
              : ''
          }`}
        >
          {key === 'BS' ? <IconBackspace className="w-6 h-6 mx-auto" /> : key}
        </button>
      ))}
    </div>
  );
}
