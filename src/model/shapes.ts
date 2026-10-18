import type { ShapeKind } from './types';

export interface ShapeSpec {
  label: string;
  /** Paletteki grup */
  group: 'general' | 'vsm' | 'pull';
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
  control: {
    label: 'Üretim kontrolü',
    group: 'vsm',
    hint: 'Planlama / MRP-ERP ofisi',
    defaultTitle: 'Üretim kontrolü',
    width: 170,
    height: 70,
    minWidth: 100,
    minHeight: 50,
    color: '#f1f5f9',
  },
  operator: {
    label: 'Operatör',
    group: 'vsm',
    hint: 'Çalışan sayısını gösteren simge',
    defaultTitle: 'Operatör',
    width: 50,
    height: 60,
    minWidth: 30,
    minHeight: 36,
    color: '#ffffff',
  },
  truck: {
    label: 'Kamyon sevkiyatı',
    group: 'vsm',
    hint: 'Dış sevkiyat (sıklığı başlığa yazın)',
    defaultTitle: 'Sevkiyat',
    width: 100,
    height: 60,
    minWidth: 60,
    minHeight: 36,
    color: '#ffffff',
  },
  supermarket: {
    label: 'Süpermarket',
    group: 'pull',
    hint: 'Kontrollü stok: sonraki proses buradan çeker',
    defaultTitle: 'Süpermarket',
    width: 80,
    height: 60,
    minWidth: 50,
    minHeight: 40,
    color: '#ffffff',
  },
  fifo: {
    label: 'FIFO şeridi',
    group: 'pull',
    hint: 'İlk giren ilk çıkar; en fazla adet sınırlı',
    defaultTitle: 'FIFO',
    width: 120,
    height: 40,
    minWidth: 70,
    minHeight: 26,
    color: '#ffffff',
  },
  safetyStock: {
    label: 'Güvenlik stoğu',
    group: 'pull',
    hint: 'Tampon / emniyet stoğu',
    defaultTitle: 'Güvenlik stoğu',
    width: 70,
    height: 60,
    minWidth: 40,
    minHeight: 36,
    color: '#ffffff',
  },
  kanbanProduction: {
    label: 'Üretim kanbanı',
    group: 'pull',
    hint: 'Üretim yetkisi veren kart',
    defaultTitle: 'Üretim kanbanı',
    width: 70,
    height: 50,
    minWidth: 40,
    minHeight: 30,
    color: '#ffffff',
  },
  kanbanWithdrawal: {
    label: 'Çekme kanbanı',
    group: 'pull',
    hint: 'Malzemeyi süpermarketten çekme kartı',
    defaultTitle: 'Çekme kanbanı',
    width: 70,
    height: 50,
    minWidth: 40,
    minHeight: 30,
    color: '#ffffff',
  },
  kanbanSignal: {
    label: 'Sinyal kanbanı',
    group: 'pull',
    hint: 'Parti üretimini tetikleyen sinyal (üçgen)',
    defaultTitle: 'Sinyal kanbanı',
    width: 60,
    height: 55,
    minWidth: 36,
    minHeight: 32,
    color: '#ffffff',
  },
  kanbanPost: {
    label: 'Kanban posta kutusu',
    group: 'pull',
    hint: 'Kanban kartlarının toplandığı yer',
    defaultTitle: 'Kanban kutusu',
    width: 60,
    height: 55,
    minWidth: 36,
    minHeight: 32,
    color: '#ffffff',
  },
  heijunka: {
    label: 'Yükleme dengeleme',
    group: 'pull',
    hint: 'Heijunka kutusu: hacim ve karışım dengeleme',
    defaultTitle: 'Heijunka',
    width: 110,
    height: 50,
    minWidth: 70,
    minHeight: 30,
    color: '#ffffff',
  },
  goSee: {
    label: 'Git gör',
    group: 'pull',
    hint: 'Bilgiyi yerinde görerek planlama',
    defaultTitle: 'Git gör',
    width: 70,
    height: 45,
    minWidth: 40,
    minHeight: 28,
    color: '#ffffff',
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
