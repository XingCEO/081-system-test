/**
 * Geometric avatar generator — creates a unique abstract pattern
 * based on a name string seed. No emojis, no external images.
 */

interface UserAvatarProps {
  name: string;
  size?: number;
  className?: string;
}

// Simple hash from string to deterministic numbers
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// Palette — muted, professional tones
const PALETTES = [
  ['#6366f1', '#818cf8', '#c7d2fe'], // indigo
  ['#0ea5e9', '#38bdf8', '#bae6fd'], // sky
  ['#10b981', '#34d399', '#a7f3d0'], // emerald
  ['#f43f5e', '#fb7185', '#fecdd3'], // rose
  ['#8b5cf6', '#a78bfa', '#ddd6fe'], // violet
  ['#f59e0b', '#fbbf24', '#fef3c7'], // amber
  ['#06b6d4', '#22d3ee', '#cffafe'], // cyan
  ['#ec4899', '#f472b6', '#fbcfe8'], // pink
];

export default function UserAvatar({ name, size = 44, className = '' }: UserAvatarProps) {
  const seed = hashCode(name);
  const palette = PALETTES[seed % PALETTES.length];
  const [bg, mid, light] = palette;

  // Deterministic shape variations
  const v1 = (seed >> 4) % 6;
  const v2 = (seed >> 8) % 4;
  const rotation = ((seed >> 12) % 8) * 45;

  const initial = name.charAt(0).toUpperCase();
  const r = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      style={{ borderRadius: size > 48 ? 16 : 12 }}
    >
      {/* Background */}
      <rect width={size} height={size} rx={size > 48 ? 16 : 12} fill={bg} />

      {/* Geometric shapes — layered */}
      <g opacity="0.25">
        {v1 === 0 && (
          <>
            <circle cx={size * 0.75} cy={size * 0.25} r={size * 0.3} fill={mid} />
            <circle cx={size * 0.2} cy={size * 0.8} r={size * 0.22} fill={light} />
          </>
        )}
        {v1 === 1 && (
          <>
            <rect x={size * 0.55} y={-size * 0.1} width={size * 0.5} height={size * 0.5} rx={8} fill={mid} transform={`rotate(${rotation} ${size * 0.75} ${size * 0.15})`} />
            <rect x={-size * 0.05} y={size * 0.6} width={size * 0.4} height={size * 0.4} rx={8} fill={light} transform={`rotate(${rotation + 20} ${size * 0.15} ${size * 0.8})`} />
          </>
        )}
        {v1 === 2 && (
          <>
            <polygon points={`${r},${size * 0.05} ${size * 0.95},${size * 0.65} ${size * 0.05},${size * 0.65}`} fill={mid} />
          </>
        )}
        {v1 === 3 && (
          <>
            <circle cx={size * 0.5} cy={size * 0.5} r={size * 0.35} fill="none" stroke={mid} strokeWidth={size * 0.08} />
            <circle cx={size * 0.5} cy={size * 0.5} r={size * 0.18} fill={light} />
          </>
        )}
        {v1 === 4 && (
          <>
            <line x1={0} y1={size * 0.3} x2={size} y2={size * 0.15} stroke={mid} strokeWidth={size * 0.12} strokeLinecap="round" />
            <line x1={0} y1={size * 0.7} x2={size} y2={size * 0.85} stroke={light} strokeWidth={size * 0.08} strokeLinecap="round" />
          </>
        )}
        {v1 === 5 && (
          <>
            <path d={`M0,${size} Q${size * 0.3},${size * 0.4} ${size},${size * 0.6} L${size},${size} Z`} fill={mid} />
            {v2 > 1 && <circle cx={size * 0.75} cy={size * 0.2} r={size * 0.12} fill={light} />}
          </>
        )}
      </g>

      {/* Subtle top-left shine */}
      <rect width={size} height={size} rx={size > 48 ? 16 : 12} fill="url(#shine)" />
      <defs>
        <linearGradient id="shine" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.12" />
          <stop offset="50%" stopColor="white" stopOpacity="0" />
          <stop offset="100%" stopColor="black" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Initial letter */}
      <text
        x="50%"
        y="50%"
        dy="0.35em"
        textAnchor="middle"
        fill="white"
        fontSize={size * 0.4}
        fontWeight="700"
        fontFamily="system-ui, -apple-system, sans-serif"
        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.15)' }}
      >
        {initial}
      </text>
    </svg>
  );
}
