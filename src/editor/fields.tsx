/**
 * Campos do editor.
 *
 * Estavam repetidos em cada painel; agora sao um lugar so. Nada de esperto
 * aqui: rotulo em cima, campo embaixo, dica opcional embaixo do campo.
 */

export function NumberField({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <label className="efield">
      {label}
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={Math.round(value * 100) / 100}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {suffix && <small>{suffix}</small>}
    </label>
  );
}

export function SliderField({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <label className="efield">
      {label}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <small>
        {Math.round(value * 100) / 100}
        {suffix ? ` ${suffix}` : ''}
      </small>
    </label>
  );
}

export function ColorField({
  label,
  value,
  onChange,
  allowEmpty = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** deixa apagar a cor (borda sem cor = sem borda) */
  allowEmpty?: boolean;
}) {
  return (
    <label className="efield ecolor">
      {label}
      <span className="ecolor-row">
        <input type="color" value={value || '#000000'} onChange={(e) => onChange(e.target.value)} />
        <input
          type="text"
          value={value}
          placeholder={allowEmpty ? 'sem cor' : '#000000'}
          onChange={(e) => onChange(e.target.value)}
        />
        {allowEmpty && value && (
          <button className="ebtn" onClick={() => onChange('')} title="Tirar a cor">
            ×
          </button>
        )}
      </span>
    </label>
  );
}

export function CheckField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="efield echeck">
      <span>
        <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </span>
      {hint && <small>{hint}</small>}
    </label>
  );
}
