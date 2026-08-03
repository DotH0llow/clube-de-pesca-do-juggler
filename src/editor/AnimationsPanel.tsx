import { useEffect, useRef, useState } from 'react';
import { CLIPS, clipFrame } from '../assets';
import { clipConfig, resetAnims, resetClip, setClip, useAnims, type ClipMode } from './anims';
import { MECHANICS, resetFx, updateFx, updateTimings, useFx, type FxItem } from './fx';
import { currentStep, goToStep, moveStep, setMechanic, stepsOf, usePreview } from './preview';

/**
 * Secao ANIMACOES do editor.
 *
 * Duas partes:
 *
 *   SEQUENCIAS - toda pasta de quadros que existe em `assets/game`, agrupada
 *   pela categoria. Da para ver quadro a quadro, montar a ordem na mao, mudar o
 *   ritmo e assistir ao resultado rodando ali do lado.
 *
 *   MECANICAS - a mesma coisa para os efeitos do jogo, so que passo a passo:
 *   escolha a mecanica, ande pelas etapas e ajuste cada peca que aparece na
 *   tela. O que voce mexer aqui vale no jogo no proximo lance.
 */

// ============================================================== sequencias

function ClipPreview({ path, count }: { path: string; count: number }) {
  const anims = useAnims();
  const cfg = anims[path] ?? clipConfig(path);
  const [i, setI] = useState(0);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (timer.current !== undefined) window.clearInterval(timer.current);
    if (cfg.frames.length <= 1) {
      setI(0);
      return;
    }
    timer.current = window.setInterval(
      () => setI((v) => (v + 1) % cfg.frames.length),
      Math.max(40, cfg.frameMs),
    );
    return () => window.clearInterval(timer.current);
  }, [cfg.frames.length, cfg.frameMs]);

  const frame = Math.min(Math.max(0, cfg.frames[i % Math.max(1, cfg.frames.length)] ?? 0), count - 1);
  return (
    <div className="eanim-stage">
      <img src={clipFrame(path, frame)} alt="" />
      <span>
        {i + 1}/{cfg.frames.length || 1} · quadro {frame}
      </span>
    </div>
  );
}

const MODES: { id: ClipMode; label: string; hint: string }[] = [
  { id: 'loop', label: 'CICLO', hint: 'roda a lista sem parar, um quadro por vez' },
  { id: 'fisica', label: 'FÍSICA', hint: 'primeiro item subindo, último descendo' },
  { id: 'fase', label: 'FASE', hint: 'um item por momento do lance, na ordem da lista' },
];

function SequenceEditor({ path, count }: { path: string; count: number }) {
  const anims = useAnims();
  const cfg = anims[path] ?? clipConfig(path);

  const move = (i: number, delta: number) => {
    const next = [...cfg.frames];
    const j = i + delta;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setClip(path, { frames: next });
  };

  return (
    <div className="eanim-edit">
      <div className="etitle">{path}</div>

      <ClipPreview path={path} count={count} />

      <div className="eanim-label">SEQUÊNCIA ({cfg.frames.length} passos)</div>
      <div className="eanim-seq">
        {cfg.frames.map((f, i) => (
          <div key={`${i}-${f}`} className="eanim-slot">
            <img src={clipFrame(path, Math.min(f, count - 1))} alt="" />
            <div className="eanim-slot-bar">
              <button onClick={() => move(i, -1)} title="Para trás">
                ‹
              </button>
              <select
                value={f}
                onChange={(e) => {
                  const next = [...cfg.frames];
                  next[i] = Number(e.target.value);
                  setClip(path, { frames: next });
                }}
              >
                {Array.from({ length: count }, (_, n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <button onClick={() => move(i, 1)} title="Para frente">
                ›
              </button>
            </div>
            <div className="eanim-slot-foot">
              {cfg.slots?.[i] ? <small>{cfg.slots[i]}</small> : <small>passo {i + 1}</small>}
              <button
                className="danger"
                onClick={() => setClip(path, { frames: cfg.frames.filter((_, n) => n !== i) })}
                title="Tirar da sequência"
              >
                ×
              </button>
            </div>
          </div>
        ))}
        <button
          className="eanim-add"
          onClick={() => setClip(path, { frames: [...cfg.frames, 0] })}
          title="Somar um passo"
        >
          +
        </button>
      </div>

      <div className="eanim-label">TODOS OS QUADROS DA PASTA</div>
      <div className="eanim-all">
        {Array.from({ length: count }, (_, n) => (
          <button
            key={n}
            className="eanim-thumb"
            title={`Somar o quadro ${n} no fim da sequência`}
            onClick={() => setClip(path, { frames: [...cfg.frames, n] })}
          >
            <img src={clipFrame(path, n)} alt="" />
            <span>{n}</span>
          </button>
        ))}
      </div>

      <div className="eanim-row">
        <label>
          RITMO
          <input
            type="number"
            min={30}
            max={4000}
            step={10}
            value={cfg.frameMs}
            onChange={(e) => setClip(path, { frameMs: Number(e.target.value) || 30 })}
          />
          <small>ms por quadro</small>
        </label>
        <label>
          LEITURA
          <select
            value={cfg.mode}
            onChange={(e) => setClip(path, { mode: e.target.value as ClipMode })}
          >
            {MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <small>{MODES.find((m) => m.id === cfg.mode)?.hint}</small>
        </label>
      </div>

      <button className="ebtn" onClick={() => resetClip(path)}>
        VOLTAR ESTE CLIPE AO PADRÃO
      </button>
    </div>
  );
}

export function AnimationsPanel() {
  const [open, setOpen] = useState<string | null>('char');
  const [clip, setClipSel] = useState<string | null>('char/walk-right');

  const groups = new Map<string, typeof CLIPS>();
  for (const c of CLIPS) {
    if (!groups.has(c.group)) groups.set(c.group, []);
    groups.get(c.group)!.push(c);
  }

  const selected = CLIPS.find((c) => c.path === clip) ?? null;

  return (
    <div className="editor-panel wide">
      <div className="etitle">ANIMAÇÕES · SEQUÊNCIAS DE QUADRO</div>
      <div className="eanim-body">
        <div className="eanim-tree">
          {[...groups.entries()].map(([group, list]) => (
            <div key={group}>
              <button className="eanim-folder" onClick={() => setOpen(open === group ? null : group)}>
                {open === group ? '▾' : '▸'} {group.toUpperCase()} <small>({list.length})</small>
              </button>
              {open === group &&
                list.map((c) => (
                  <button
                    key={c.path}
                    className={`eanim-clip${clip === c.path ? ' on' : ''}`}
                    onClick={() => setClipSel(c.path)}
                  >
                    <img src={clipFrame(c.path, 0)} alt="" />
                    <span className="grow">{c.name}</span>
                    <small>{c.count}q</small>
                  </button>
                ))}
            </div>
          ))}
          <button className="ebtn danger" onClick={() => confirm('Voltar TODAS as sequências ao padrão?') && resetAnims()}>
            RESETAR TUDO
          </button>
        </div>

        {selected ? (
          <SequenceEditor path={selected.path} count={selected.count} />
        ) : (
          <div className="eanim-edit">
            <div className="ehint">Escolha um clipe na árvore da esquerda.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================== mecanicas

function NumberField({
  label,
  value,
  onChange,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  suffix?: string;
}) {
  return (
    <label className="efield">
      {label}
      <input
        type="number"
        step={step}
        value={Math.round(value * 100) / 100}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {suffix && <small>{suffix}</small>}
    </label>
  );
}

export function MechanicsPanel({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const fx = useFx();
  const preview = usePreview();
  const steps = stepsOf(preview.mechanic);
  const step = currentStep();
  const item: FxItem | undefined = fx.items.find((i) => i.id === selected);

  return (
    <div className="editor-panel wide">
      <div className="etitle">ANIMAÇÕES POR MECÂNICA · SIMULAÇÃO PASSO A PASSO</div>

      <div className="emech-row">
        {MECHANICS.map((m) => (
          <button
            key={m.id}
            className={`ebtn${preview.mechanic === m.id ? ' primary' : ''}`}
            onClick={() => setMechanic(preview.mechanic === m.id ? null : m.id)}
          >
            {m.label}
          </button>
        ))}
        <div className="grow" />
        <button className="ebtn danger" onClick={() => confirm('Voltar as mecânicas ao padrão?') && resetFx()}>
          RESETAR
        </button>
      </div>

      {!preview.mechanic ? (
        <div className="ehint">
          Escolha uma mecânica para o jogo congelar na etapa que você quiser ver. Cada peça que
          aparecer na tela pode ser arrastada, redimensionada e cronometrada aqui.
        </div>
      ) : (
        <>
          <div className="emech-steps">
            <button className="ebtn" onClick={() => moveStep(-1)} disabled={preview.stepIndex === 0}>
              ◀ VOLTAR
            </button>
            <div className="emech-now">
              <strong>{step?.label}</strong>
              <small>{step?.hint}</small>
            </div>
            <button
              className="ebtn"
              onClick={() => moveStep(1)}
              disabled={preview.stepIndex >= steps.length - 1}
            >
              AVANÇAR ▶
            </button>
          </div>

          <div className="emech-dots">
            {steps.map((s, i) => (
              <button
                key={s.id}
                className={`emech-dot${i === preview.stepIndex ? ' on' : ''}`}
                onClick={() => goToStep(i)}
                title={s.label}
              >
                {i + 1}
              </button>
            ))}
          </div>

          <div className="eanim-label">PEÇAS DESTA ETAPA</div>
          <div className="emech-list">
            {fx.items
              .filter((i) => step && i.steps.includes(step.id))
              .map((i) => (
                <button
                  key={i.id}
                  className={`eitem${selected === i.id ? ' on' : ''}`}
                  onClick={() => onSelect(selected === i.id ? null : i.id)}
                >
                  <span className="grow">{i.label}</span>
                  <small>{i.point ? 'ponto' : `${Math.round(i.w)}×${Math.round(i.h)}`}</small>
                </button>
              ))}
            {step && fx.items.filter((i) => i.steps.includes(step.id)).length === 0 && (
              <div className="ehint">Nenhuma peça editável nesta etapa.</div>
            )}
          </div>

          {item && (
            <div className="emech-form">
              <div className="etitle">{item.label}</div>
              <div className="efields">
                <NumberField label="X" value={item.x} onChange={(v) => updateFx(item.id, { x: v })} />
                <NumberField label="Y" value={item.y} onChange={(v) => updateFx(item.id, { y: v })} />
                {!item.point && (
                  <>
                    <NumberField label="LARG" value={item.w} onChange={(v) => updateFx(item.id, { w: Math.max(1, v) })} />
                    <NumberField label="ALT" value={item.h} onChange={(v) => updateFx(item.id, { h: Math.max(1, v) })} />
                    <NumberField label="GIRO" value={item.rot} onChange={(v) => updateFx(item.id, { rot: v })} suffix="graus" />
                    <NumberField
                      label="OPACID"
                      value={item.opacity}
                      step={0.05}
                      onChange={(v) => updateFx(item.id, { opacity: Math.min(1, Math.max(0, v)) })}
                    />
                  </>
                )}
              </div>
              <small className="ehint">
                {item.point
                  ? 'Ponto de referência: a linha de pesca sai daqui. Arraste a cruz na tela.'
                  : 'Arraste na tela ou use as alças. Os números são unidades de mundo.'}
              </small>
            </div>
          )}

          <div className="eanim-label">TEMPOS DA MECÂNICA</div>
          <div className="efields">
            <NumberField
              label="JANELA DO FISGAR"
              value={fx.timings.biteWindowMs}
              step={100}
              suffix="ms"
              onChange={(v) => updateTimings({ biteWindowMs: Math.max(200, v) })}
            />
            <NumberField
              label="SEGURA O ARREMESSO"
              value={fx.timings.castHoldMs}
              step={20}
              suffix="ms"
              onChange={(v) => updateTimings({ castHoldMs: Math.max(0, v) })}
            />
            <NumberField
              label="BOIA · X"
              value={fx.timings.bobberDx}
              suffix="da vara"
              onChange={(v) => updateTimings({ bobberDx: v })}
            />
            <NumberField
              label="BOIA · Y"
              value={fx.timings.bobberY}
              onChange={(v) => updateTimings({ bobberY: v })}
            />
            <NumberField
              label="LINHA · GROSSURA"
              value={fx.timings.lineWidth}
              step={0.5}
              onChange={(v) => updateTimings({ lineWidth: Math.max(0.5, v) })}
            />
            <NumberField
              label="LINHA · BARRIGA"
              value={fx.timings.lineSag}
              onChange={(v) => updateTimings({ lineSag: v })}
            />
          </div>
        </>
      )}
    </div>
  );
}
