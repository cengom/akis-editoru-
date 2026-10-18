import type { ShapeKind } from './types';

export interface ShapeSpec {
  label: string;
  /** Paletteki grup */
  group: 'general' | 'vsm';
  hint: string;
  defaultTitle: string;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  color: string;
}

/** Paletteki şekillerin tanımı: ad, varsayılan boyut ve renk. */
export const SHAPES: Record<ShapeKind, ShapeSpec> = {
  terminal: {
    label: 'Başlangıç / Bitiş',
    group: 'general',
    hint: 'Sürecin başladığı ya da bittiği nokta',
    defaultTitle: 'Başlangıç',
    width: 160,
    height: 60,
    minWidth: 80,
    minHeight: 40,
    color: '#d1fae5',
  },
  process: {
    label: 'Proses',
    group: 'general',
    hint: 'Yapılan bir iş veya adım',
    defaultTitle: 'Yeni proses',
    width: 180,
    height: 80,
    minWidth: 80,
    minHeight: 40,
    color: '#dbeafe',
  },
  decision: {
    label: 'Karar',
    group: 'general',
    hint: 'Evet / Hayır gibi bir soru',
    defaultTitle: 'Karar?',
    width: 160,
    height: 110,
    minWidth: 80,
    minHeight: 60,
    color: '#fef3c7',
  },
  department: {
    label: 'Departman',
    group: 'general',
    hint: 'Adımları bir bölüm altında toplayan alan',
    defaultTitle: 'Departman',
    width: 360,
    height: 240,
    minWidth: 160,
    minHeight: 100,
    color: '#ede9fe',
  },
  note: {
    label: 'Not',
    group: 'general',
    hint: 'Açıklama veya hatırlatma',
    defaultTitle: 'Not',
    width: 180,
    height: 110,
    minWidth: 80,
    minHeight: 50,
    color: '#fef9c3',
  },
  customer: {
    label: 'Müşteri',
    group: 'vsm',
    hint: 'Ürünü alan dış müşteri (fabrika simgesi)',
    defaultTitle: 'Müşteri',
    width: 150,
    height: 100,
    minWidth: 100,
    minHeight: 70,
    color: '#ffffff',
  },
  supplier: {
    label: 'Tedarikçi',
    group: 'vsm',
    hint: 'Malzeme sağlayan dış firma (fabrika simgesi)',
    defaultTitle: 'Tedarikçi',
    width: 150,
    height: 100,
    minWidth: 100,
    minHeight: 70,
    color: '#ffffff',
  },
  inventory: {
    label: 'Stok / envanter',
    group: 'vsm',
    hint: 'Prosesler arasında bekleyen stok (üçgen)',
    defaultTitle: 'Stok',
    width: 70,
    height: 60,
    minWidth: 40,
    minHeight: 35,
    color: '#fde68a',
  },
  kaizen: {
    label: 'Kaizen patlaması',
    group: 'vsm',
    hint: 'İyileştirme fırsatı',
    defaultTitle: 'Kaizen',
    width: 150,
    height: 100,
    minWidth: 90,
    minHeight: 60,
    color: '#fef08a',
  },
};

/** Özellik panelindeki hazır renkler. */
export const COLOR_PRESETS = [
  '#ffffff',
  '#dbeafe',
  '#d1fae5',
  '#fef3c7',
  '#fef9c3',
  '#fee2e2',
  '#ede9fe',
  '#e5e7eb',
  '#1e3a8a',
  '#065f46',
];

/** Departman alanları bağlantıların ve diğer şekillerin arkasında kalır. */
export function zIndexFor(kind: ShapeKind): number {
  return kind === 'department' ? 0 : 2;
}

/** Arka plan rengine göre okunaklı yazı rengi (koyu ya da açık). */
export function readableTextColor(hex: string): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return '#111827';
  const [r, g, b] = m.slice(1).map((h) => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.35 ? '#111827' : '#ffffff';
}
