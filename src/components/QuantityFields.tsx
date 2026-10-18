import { useEffect, useState } from 'react';
import type { VsmQuantity, VsmUnit } from '../model/types';
import { checkVsmValue, numberToInput, parseNumberInput, type QuantitySpec } from '../model/vsm';

/** Sayı + birim alanlarından oluşan düzenleme tablosu (proses ve harita alanları için ortak). */
export function QuantityTable<K extends string>({
  specs,
  values,
  onChange,
  idPrefix,
}: {
  specs: readonly QuantitySpec<K>[];
  values: Record<K, VsmQuantity>;
  onChange: (key: K, q: VsmQuantity) => void;
  idPrefix: string;
}) {
  return (
    <table className="vsm-table">
      <tbody>
        {specs.map((spec) => (
          <QuantityRow
            key={spec.key}
            id={`${idPrefix}-${spec.key}`}
            spec={spec}
            quantity={values[spec.key]}
            onChange={(q) => onChange(spec.key, q)}
          />
        ))}
      </tbody>
    </table>
  );
}

function QuantityRow({
  id,
  spec,
  quantity,
  onChange,
}: {
  id: string;
  spec: QuantitySpec;
  quantity: VsmQuantity;
  onChange: (q: VsmQuantity) => void;
}) {
  // Yazarken "12," gibi yarım değerler kaybolmasın diye metin ayrı tutulur.
  const [draft, setDraft] = useState(numberToInput(quantity.value));
  const [error, setError] = useState<string | null>(null);

  // Değer dışarıdan değiştiyse (ör. içe aktarma) metni eşitle.
  useEffect(() => {
    const parsed = parseNumberInput(draft);
    if (!parsed.ok || parsed.value !== quantity.value) {
      setDraft(numberToInput(quantity.value));
      setError(null);
    }
  }, [quantity.value]);

  const onText = (text: string) => {
    setDraft(text);
    const parsed = parseNumberInput(text);
    if (!parsed.ok) return setError('Geçerli bir sayı girin.');
    const problem = checkVsmValue(spec, parsed.value);
    setError(problem);
    if (!problem) onChange({ ...quantity, value: parsed.value });
  };

  return (
    <tr>
      <th scope="row">
        <label htmlFor={id}>{spec.label}</label>
        {spec.hint && <div className="field-hint">{spec.hint}</div>}
      </th>
      <td className="value">
        <input
          id={id}
          inputMode="decimal"
          className={error ? 'invalid' : undefined}
          value={draft}
          placeholder="—"
          onChange={(e) => onText(e.target.value)}
          aria-invalid={error ? true : undefined}
          data-testid={id}
        />
        {error && <div className="field-error">{error}</div>}
      </td>
      <td className="unit">
        {spec.units.length > 1 ? (
          <select
            value={quantity.unit}
            onChange={(e) => onChange({ ...quantity, unit: e.target.value as VsmUnit })}
            aria-label={`${spec.label} birimi`}
            data-testid={`${id}-birim`}
          >
            {spec.units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        ) : (
          <span className="unit-fixed">{quantity.unit}</span>
        )}
      </td>
    </tr>
  );
}
