import type { ShapeNode, VsmData, VsmFieldKey, VsmQuantity, VsmUnit } from './types';
import { VSM_FIELDS, checkVsmValue, emptyVsm, numberToInput, parseNumberInput } from './vsm';

/*
 * Proses VSM verilerinin CSV (Excel) ile alışverişi.
 * Biçim: noktalı virgül ayraçlı, UTF-8 (BOM'lu), ondalık ayırıcı virgül — Türkçe Excel'in varsayılanı.
 * Sütunlar alan kataloğundan üretilir: "Proses" + her alan için değer (+ birden çok birimi varsa "… birimi").
 */

const NAME_COL = 'Proses';
const unitCol = (label: string) => `${label} birimi`;

function headers(): string[] {
  const h = [NAME_COL];
  for (const f of VSM_FIELDS) {
    h.push(f.label);
    if (f.units.length > 1) h.push(unitCol(f.label));
  }
  return h;
}

const quote = (s: string) => (/[;"\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** Açık haritadaki proseslerin verisini CSV metni olarak üretir. */
export function processesToCsv(nodes: ShapeNode[]): string {
  const rows = [headers()];
  for (const n of nodes.filter((x) => x.type === 'process').sort((a, b) => a.position.x - b.position.x)) {
    const vsm = n.data.vsm ?? emptyVsm();
    const row = [n.data.title];
    for (const f of VSM_FIELDS) {
      const q = vsm.fields[f.key];
      row.push(numberToInput(q.value));
      if (f.units.length > 1) row.push(q.unit);
    }
    rows.push(row);
  }
  return '﻿' + rows.map((r) => r.map(quote).join(';')).join('\r\n') + '\r\n';
}

/** Basit CSV ayrıştırıcı: tırnaklı alanlar, satır sonları, ; ya da , ayraç. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQ = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQ) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') inQ = false;
      else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === sep) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export interface CsvImportPlan {
  /** Proses kimliği → yeni VSM verisi */
  updates: Map<string, VsmData>;
  /** Tuvalde bulunamayan proses adları */
  unmatched: string[];
  errors: string[];
}

const norm = (s: string) => s.trim().toLocaleLowerCase('tr-TR');

/**
 * CSV'yi doğrular ve hangi prosesin nasıl güncelleneceğini hesaplar (hiçbir şeyi değiştirmez).
 * Prosesler başlıklarına göre eşleşir. Boş hücre "veri yok" olarak yazılır; dosyada olmayan sütunlar korunur.
 */
export function planCsvImport(text: string, nodes: ShapeNode[]): CsvImportPlan {
  const errors: string[] = [];
  const rows = parseCsv(text);
  if (rows.length < 2) return { updates: new Map(), unmatched: [], errors: ['Dosyada başlık satırı ve en az bir proses satırı olmalı.'] };
  const head = rows[0].map(norm);
  const nameIdx = head.indexOf(norm(NAME_COL));
  if (nameIdx < 0) return { updates: new Map(), unmatched: [], errors: [`"${NAME_COL}" sütunu bulunamadı.`] };
  const cols = VSM_FIELDS.map((f) => ({ f, vi: head.indexOf(norm(f.label)), ui: head.indexOf(norm(unitCol(f.label))) }));
  if (cols.every((c) => c.vi < 0)) return { updates: new Map(), unmatched: [], errors: ['Tanınan hiçbir VSM sütunu yok.'] };

  const processes = nodes.filter((n) => n.type === 'process');
  const updates = new Map<string, VsmData>();
  const unmatched: string[] = [];
  rows.slice(1).forEach((r, i) => {
    const where = `${i + 2}. satır`;
    const name = (r[nameIdx] ?? '').trim();
    if (!name) return errors.push(`${where}: proses adı boş.`);
    const matches = processes.filter((p) => norm(p.data.title) === norm(name));
    if (matches.length === 0) return unmatched.push(name);
    if (matches.length > 1) return errors.push(`${where}: "${name}" adında birden fazla proses var; adları ayırın.`);
    const target = matches[0];
    const vsm: VsmData = JSON.parse(JSON.stringify(target.data.vsm ?? emptyVsm()));
    for (const { f, vi, ui } of cols) {
      if (vi < 0) continue;
      const parsed = parseNumberInput(r[vi] ?? '');
      if (!parsed.ok) {
        errors.push(`${where}: "${f.label}" sayı değil (${r[vi]}).`);
        continue;
      }
      const problem = checkVsmValue(f, parsed.value);
      if (problem) {
        errors.push(`${where}: "${f.label}" — ${problem}`);
        continue;
      }
      const unitText = ui >= 0 ? (r[ui] ?? '').trim() : '';
      const unit = (unitText || vsm.fields[f.key].unit) as VsmUnit;
      if (!f.units.includes(unit)) {
        errors.push(`${where}: "${f.label}" için birim "${unitText}" geçersiz (${f.units.join(', ')}).`);
        continue;
      }
      vsm.fields[f.key as VsmFieldKey] = { value: parsed.value, unit } as VsmQuantity;
    }
    updates.set(target.id, vsm);
  });
  return { updates, unmatched, errors: errors.slice(0, 10) };
}
