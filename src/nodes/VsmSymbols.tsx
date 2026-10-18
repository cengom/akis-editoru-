import type { ShapeKind } from '../model/types';

/** Simge olarak çizilen VSM şekilleri (başlık simgenin altında yazılır). */
export const SYMBOL_KINDS = [
  'operator',
  'truck',
  'supermarket',
  'fifo',
  'safetyStock',
  'kanbanProduction',
  'kanbanWithdrawal',
  'kanbanSignal',
  'kanbanPost',
  'heijunka',
  'goSee',
] as const satisfies readonly ShapeKind[];
export type SymbolKind = (typeof SYMBOL_KINDS)[number];
export const isSymbolKind = (k: string): k is SymbolKind => (SYMBOL_KINDS as readonly string[]).includes(k);

const S = '#374151';

/**
 * Sembolün çizimi (100×60 alanında). Hem tuvalde hem palette kullanılır.
 * `fill` şeklin rengi; çizgiler koyu gri.
 */
export function SymbolSvg({ kind, fill, className }: { kind: SymbolKind; fill: string; className?: string }) {
  const common = { fill, stroke: S, strokeWidth: 3, strokeLinejoin: 'round' as const, vectorEffect: 'non-scaling-stroke' as const };
  const line = { fill: 'none', stroke: S, strokeWidth: 3, strokeLinecap: 'round' as const, vectorEffect: 'non-scaling-stroke' as const };
  let body;
  switch (kind) {
    case 'operator':
      body = (
        <>
          <circle cx="50" cy="16" r="11" {...common} />
          <path d="M28 57 Q50 20 72 57 Z" {...common} />
        </>
      );
      break;
    case 'truck':
      body = (
        <>
          <rect x="4" y="10" width="60" height="34" {...common} />
          <path d="M64 20 H83 L95 33 V44 H64 Z" {...common} />
          <circle cx="22" cy="49" r="7" {...common} />
          <circle cx="80" cy="49" r="7" {...common} />
        </>
      );
      break;
    case 'supermarket':
      // Sola açık raf: sonraki proses buradan çeker
      body = (
        <>
          <path d="M22 6 H80 V54 H22" {...common} />
          <path d="M80 22 H38 M80 38 H38" {...line} />
        </>
      );
      break;
    case 'fifo':
      body = (
        <>
          <path d="M4 12 H96 M4 48 H96" {...line} />
          <path d="M80 30 H92 M86 24 L92 30 L86 36" {...line} />
          <text x="42" y="37" textAnchor="middle" fontSize="20" fontWeight="700" fill={S}>
            FIFO
          </text>
        </>
      );
      break;
    case 'safetyStock':
      body = (
        <>
          <rect x="26" y="6" width="48" height="48" {...common} />
          <path d="M26 22 H74 M26 38 H74" {...line} />
        </>
      );
      break;
    case 'kanbanProduction':
      body = (
        <>
          <path d="M12 8 H78 L90 20 V52 H12 Z" {...common} />
          <path d="M24 26 H70 M24 38 H58" {...line} />
        </>
      );
      break;
    case 'kanbanWithdrawal':
      body = (
        <>
          <path d="M12 8 H78 L90 20 V52 H12 Z" {...common} />
          <circle cx="72" cy="38" r="7" {...common} fill={S} />
          <path d="M24 26 H60" {...line} />
        </>
      );
      break;
    case 'kanbanSignal':
      body = <path d="M14 6 H86 L50 56 Z" {...common} />;
      break;
    case 'kanbanPost':
      body = (
        <>
          <path d="M16 56 V24 Q50 -2 84 24 V56 Z" {...common} />
          <path d="M34 30 H66" {...line} />
        </>
      );
      break;
    case 'heijunka':
      body = (
        <>
          <rect x="4" y="8" width="92" height="44" {...common} />
          <path d="M27 8 V52 M50 8 V52 M73 8 V52" {...line} />
          <text y="37" fontSize="18" fontWeight="700" fill={S} textAnchor="middle">
            <tspan x="15.5">O</tspan>
            <tspan x="38.5">X</tspan>
            <tspan x="61.5">O</tspan>
            <tspan x="84.5">X</tspan>
          </text>
        </>
      );
      break;
    case 'goSee':
      body = (
        <>
          <circle cx="31" cy="34" r="14" {...common} />
          <circle cx="69" cy="34" r="14" {...common} />
          <path d="M45 34 Q50 28 55 34 M17 32 L6 22 M83 32 L94 22" {...line} />
        </>
      );
      break;
  }
  return (
    <svg className={className} viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {body}
    </svg>
  );
}
