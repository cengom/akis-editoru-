import { newId } from '../model/document';
import type { ProductFamily, VsmMapData } from '../model/types';
import { COST_SPEC, DEMAND_SPEC, FAMILY_COLORS, MAX_FAMILIES, PACK_SPEC, newFamily } from '../model/vsm';
import { QuantityTable } from './QuantityFields';

/** Harita panelinde ürün aileleri: ad, talep, paket adedi, birim maliyet; ekle / sil. */
export function FamilyEditor({ vsmMap, onChange }: { vsmMap: VsmMapData; onChange: (m: VsmMapData) => void }) {
  const fams = vsmMap.families;
  const setFamily = (id: string, patch: Partial<ProductFamily>) =>
    onChange({ ...vsmMap, families: fams.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
  const add = () => {
    if (fams.length >= MAX_FAMILIES) return;
    // Renk: kullanılmayan ilk palet rengi (sabit sıra; yeni renk üretilmez).
    const used = new Set(fams.map((f) => f.color));
    const fam = newFamily(fams.length, newId('aile'));
    fam.color = FAMILY_COLORS.find((c) => !used.has(c)) ?? fam.color;
    onChange({ ...vsmMap, families: [...fams, fam] });
  };
  const remove = (id: string) => {
    if (fams.length <= 1) return;
    onChange({
      ...vsmMap,
      families: fams.filter((f) => f.id !== id),
      familyView: vsmMap.familyView === id ? 'all' : vsmMap.familyView,
    });
  };
  return (
    <div className="family-editor" data-testid="aile-listesi">
      {fams.map((f) => (
        <div key={f.id} className="family-card">
          <div className="family-head">
            <span className="family-dot" style={{ background: f.color }} aria-hidden="true" />
            <input
              value={f.name}
              maxLength={100}
              aria-label="Aile adı"
              onChange={(e) => setFamily(f.id, { name: e.target.value })}
              data-testid={`aile-adi-${f.id}`}
            />
            {fams.length > 1 && (
              <button type="button" className="icon danger-text" title="Aileyi sil" aria-label={`${f.name} ailesini sil`} onClick={() => remove(f.id)}>
                ×
              </button>
            )}
          </div>
          <QuantityTable
            specs={[DEMAND_SPEC, PACK_SPEC, COST_SPEC]}
            values={{ demand: f.demand, packQuantity: f.packQuantity, unitCost: f.unitCost }}
            onChange={(key, q) => setFamily(f.id, { [key]: q })}
            idPrefix={`aile-${f.id}`}
          />
        </div>
      ))}
      {fams.length < MAX_FAMILIES ? (
        <button type="button" onClick={add} data-testid="aile-ekle">
          + Ürün ailesi ekle
        </button>
      ) : (
        <p className="muted small">En fazla {MAX_FAMILIES} aile.</p>
      )}
    </div>
  );
}
