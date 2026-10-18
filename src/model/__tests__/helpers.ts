import { fromDocument } from '../document';
import { createExampleDocument } from '../example';
import { emptyVsm } from '../vsm';
import type { DiagramDocument, VsmData, VsmFieldKey, VsmQuantity } from '../types';

/** Örnek haritayı tuval biçimine çevirir (hesap testleri için). */
export function exampleCanvas(change?: (doc: DiagramDocument) => void) {
  const doc = createExampleDocument();
  change?.(doc);
  return { doc, ...fromDocument(doc) };
}

/** Yalnızca verilen alanları dolu VSM verisi. */
export function vsmWith(fields: Partial<Record<VsmFieldKey, [number, VsmQuantity['unit']]>>): VsmData {
  const v = emptyVsm();
  for (const [k, [value, unit]] of Object.entries(fields) as [VsmFieldKey, [number, VsmQuantity['unit']]][]) {
    v.fields[k] = { value, unit };
  }
  return v;
}
