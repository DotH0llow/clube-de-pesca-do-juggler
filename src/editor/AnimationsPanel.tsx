import { useEffect, useRef, useState } from 'react';
import { CLIPS, clipFrame } from '../assets';
import { clipConfig, resetAnims, resetClip, setClip, useAnims, type ClipMode } from './anims';
import {
  FISHING_STEPS,
  FX_ANIMS,
  MECHANICS,
  addFxItem,
  addSound,
  duplicateFxItem,
  removeFxItem,
  removeSound,
  resetFx,
  updateFx,
  updateSound,
  updateTimings,
  useFx,
  type FxItem,
  type FxSound,
} from './fx';
import { currentStep, goToStep, moveStep, setMechanic, stepsOf, usePreview } from './preview';
import { CheckField, NumberField, SliderField } from './fields';
import { ASSET_LIST } from '../assets/dims';
import { TRACKS } from '../engine/music';
import { rodX, zoneRect } from './scene';
import type { SfxName } from '../engine/audio';

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

/** Sprites que fazem sentido pendurar numa mecanica de pesca. */
const FX_SPRITES = ASSET_LIST.filter((p) => /^(fx|props|ui|trash)\//.test(p));

const SFX_NAMES: SfxName[] = ['ui', 'cast', 'splash', 'bite', 'reel', 'coin', 'fail', 'unlock', 'chest'];

function SoundRow({ s }: { s: FxSound }) {
  const set = (patch: Partial<FxSound>) => updateSound(s.id, patch);
  return (
    <div className={`esound${s.off ? ' off' : ''}`}>
      <div className="esound-head">
        <input
          className="esound-name"
          value={s.label}
          onChange={(e) => set({ label: e.target.value })}
        />
        <button className="ebtn" onClick={() => set({ off: !s.off })}>
          {s.off ? 'LIGAR' : 'DESLIGAR'}
        </button>
        <button className="ebtn danger" onClick={() => removeSound(s.id)}>
          ×
        </button>
      </div>

      <div className="efields">
        <label className="efield">
          FONTE
          <select value={s.source} onChange={(e) => set({ source: e.target.value as FxSound['source'] })}>
            <option value="sfx">EFEITO DO MOTOR</option>
            <option value="musica">FAIXA DE ÁUDIO</option>
          </select>
        </label>

        {s.source === 'sfx' ? (
          <label className="efield">
            EFEITO
            <select value={s.sfx} onChange={(e) => set({ sfx: e.target.value as SfxName })}>
              {SFX_NAMES.map((n) => (
                <option key={n} value={n}>
                  {n.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="efield">
            FAIXA
            <select value={s.track} onChange={(e) => set({ track: e.target.value })}>
              <option value="">escolha uma faixa</option>
              {TRACKS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="efield">
          EM QUE ETAPA
          <select value={s.step} onChange={(e) => set({ step: e.target.value as FxSound['step'] })}>
            {FISHING_STEPS.map((st) => (
              <option key={st.id} value={st.id}>
                {st.label}
              </option>
            ))}
          </select>
        </label>

        <label className="efield">
          QUANDO
          <select value={s.when} onChange={(e) => set({ when: e.target.value as FxSound['when'] })}>
            <option value="entrar">AO ENTRAR NA ETAPA</option>
            <option value="sair">AO SAIR DA ETAPA</option>
          </select>
        </label>

        <NumberField label="ATRASO" value={s.delayMs} step={50} suffix="ms" onChange={(v) => set({ delayMs: Math.max(0, v) })} />
        <SliderField label="VOLUME" value={s.volume} onChange={(v) => set({ volume: v })} />
      </div>

      {s.source === 'musica' && (
        <CheckField
          label="REPETIR ENQUANTO A ETAPA DURAR"
          value={s.loop}
          onChange={(v) => set({ loop: v })}
          hint="a faixa para sozinha quando a etapa termina"
        />
      )}
    </div>
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
  const [aba, setAba] = useState<'pecas' | 'audio'>('pecas');

  const doStep = step?.id ?? 'idle';
  const sons = fx.sounds.filter((s) => s.step === doStep);

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
          aparecer na tela pode ser arrastada, redimensionada, escondida e cronometrada aqui - e o
          Ctrl+Z de dentro da simulação só desfaz mexida de mecânica, nunca de cena.
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

          <div className="emech-row">
            <button className={`ebtn${aba === 'pecas' ? ' primary' : ''}`} onClick={() => setAba('pecas')}>
              PEÇAS
            </button>
            <button className={`ebtn${aba === 'audio' ? ' primary' : ''}`} onClick={() => setAba('audio')}>
              ÁUDIO ({sons.length})
            </button>
          </div>

          {aba === 'audio' ? (
            <>
              <div className="eanim-label">SONS DESTA ETAPA</div>
              <div className="ehint">
                Cada som diz o que toca, em que etapa e se é ao entrar ou ao sair dela. Efeito do
                motor é o som procedural do jogo; faixa de áudio é um arquivo de{' '}
                <code>src/assets/music</code>.
              </div>
              {sons.map((s) => (
                <SoundRow key={s.id} s={s} />
              ))}
              {sons.length === 0 && <div className="ehint">Nenhum som nesta etapa ainda.</div>}
              <button className="ebtn primary" onClick={() => addSound(doStep)}>
                + SOM NESTA ETAPA
              </button>
            </>
          ) : (
            <>
              <div className="eanim-label">PEÇAS DESTA ETAPA</div>
              <div className="emech-list">
                {fx.items
                  .filter((i) => step && i.steps.includes(step.id))
                  .sort((a, b) => a.z - b.z)
                  .map((i) => (
                    <button
                      key={i.id}
                      className={`eitem${selected === i.id ? ' on' : ''}${i.off ? ' locked' : ''}`}
                      onClick={() => onSelect(selected === i.id ? null : i.id)}
                    >
                      <span className="edepth-tag">{i.z}</span>
                      <span className="grow">{i.label}</span>
                      <small>{i.point ? 'ponto' : `${Math.round(i.w)}×${Math.round(i.h)}`}</small>
                      <span
                        className="mini"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateFx(i.id, { off: !i.off });
                        }}
                      >
                        {i.off ? 'MOSTRAR' : 'ESCONDER'}
                      </span>
                    </button>
                  ))}
                {step && fx.items.filter((i) => i.steps.includes(step.id)).length === 0 && (
                  <div className="ehint">Nenhuma peça editável nesta etapa.</div>
                )}
              </div>

              <button
                className="ebtn primary"
                onClick={() => {
                  const novo = addFxItem(doStep);
                  onSelect(novo.id);
                }}
              >
                + PEÇA NESTA ETAPA
              </button>

              {item && (
                <div className="emech-form">
                  <label className="efield">
                    NOME
                    <input
                      value={item.label}
                      disabled={item.fixed}
                      onChange={(e) => updateFx(item.id, { label: e.target.value })}
                    />
                  </label>

                  {!item.point && item.kind === 'sprite' && (
                    <label className="efield">
                      SPRITE
                      <select value={item.sprite} onChange={(e) => updateFx(item.id, { sprite: e.target.value })}>
                        {FX_SPRITES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <div className="efields">
                    <NumberField label="X" value={item.x} onChange={(v) => updateFx(item.id, { x: v })} />
                    <NumberField label="Y" value={item.y} onChange={(v) => updateFx(item.id, { y: v })} />
                    {!item.point && (
                      <>
                        <NumberField label="LARG" value={item.w} onChange={(v) => updateFx(item.id, { w: Math.max(1, v) })} />
                        <NumberField label="ALT" value={item.h} onChange={(v) => updateFx(item.id, { h: Math.max(1, v) })} />
                        <NumberField label="GIRO" value={item.rot} onChange={(v) => updateFx(item.id, { rot: v })} suffix="graus" />
                        <SliderField
                          label="OPACIDADE"
                          value={item.opacity}
                          onChange={(v) => updateFx(item.id, { opacity: v })}
                        />
                        <NumberField
                          label="CAMADA"
                          value={item.z}
                          onChange={(v) => updateFx(item.id, { z: Math.round(v) })}
                          suffix="maior fica na frente"
                        />
                      </>
                    )}
                  </div>

                  {!item.point && (
                    <>
                      <div className="erow">
                        <button className="ebtn" onClick={() => updateFx(item.id, { z: item.z + 1 })}>
                          À FRENTE
                        </button>
                        <button className="ebtn" onClick={() => updateFx(item.id, { z: item.z - 1 })}>
                          ATRÁS
                        </button>
                      </div>

                      <div className="efields">
                        <label className="efield">
                          ANIMAÇÃO
                          <select
                            value={item.anim}
                            onChange={(e) => updateFx(item.id, { anim: e.target.value as FxItem['anim'] })}
                          >
                            {FX_ANIMS.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <CheckField
                          label="TREMER NA MORDIDA"
                          value={Boolean(item.wave)}
                          onChange={(v) => updateFx(item.id, { wave: v })}
                        />
                      </div>
                    </>
                  )}

                  <div className="eanim-label">EM QUE ETAPAS APARECE</div>
                  <div className="ehours">
                    {FISHING_STEPS.map((st) => (
                      <button
                        key={st.id}
                        className={`ebtn${item.steps.includes(st.id) ? ' primary' : ''}`}
                        onClick={() =>
                          updateFx(item.id, {
                            steps: item.steps.includes(st.id)
                              ? item.steps.filter((x) => x !== st.id)
                              : [...item.steps, st.id],
                          })
                        }
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>

                  <div className="erow">
                    <button className="ebtn" onClick={() => updateFx(item.id, { off: !item.off })}>
                      {item.off ? 'MOSTRAR' : 'ESCONDER'}
                    </button>
                    <button
                      className="ebtn"
                      onClick={() => {
                        const copy = duplicateFxItem(item.id);
                        if (copy) onSelect(copy.id);
                      }}
                    >
                      DUPLICAR
                    </button>
                    <button
                      className="ebtn danger"
                      disabled={item.fixed}
                      title={item.fixed ? 'Peça da semente: dá para esconder, não para apagar' : 'Apagar'}
                      onClick={() => {
                        removeFxItem(item.id);
                        onSelect(null);
                      }}
                    >
                      APAGAR
                    </button>
                  </div>

                  <small className="ehint">
                    {item.point
                      ? 'Ponto de referência: a linha de pesca sai daqui. Arraste a cruz na tela.'
                      : 'Arraste na tela ou use as alças - todas as oito funcionam, inclusive as de cima e de baixo. Os números são unidades de mundo.'}
                  </small>
                </div>
              )}
            </>
          )}

          <div className="eanim-label">O JUGGLER</div>
          <div className="efields">
            <NumberField
              label="ONDE ELE FICA"
              value={fx.timings.fishX ?? Math.round(rodX())}
              step={5}
              suffix="X no mundo quando a pescaria começa"
              onChange={(v) => updateTimings({ fishX: v })}
            />
          </div>
          <div className="erow">
            <button
              className="ebtn"
              onClick={() => {
                const z = zoneRect('vara');
                updateTimings({ fishX: z ? Math.round(z.x + z.w / 2) : Math.round(rodX()) });
              }}
            >
              PEGAR O CENTRO DA ÁREA DA VARA
            </button>
            <button className="ebtn" onClick={() => updateTimings({ fishX: null })}>
              VOLTAR AO AUTOMÁTICO
            </button>
          </div>
          <div className="ehint">
            {fx.timings.fishX === null
              ? 'Automático: ele para no meio da área de interação da vara.'
              : `Fixo em ${fx.timings.fishX}. É daqui que a linha sai quando o lance começa.`}
          </div>

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
