import { useState } from 'react';
import { asset } from '../assets';
import { ASSET_LIST } from '../assets/dims';
import { SKY_PHASES, type SkyPhaseId } from '../data/skies';
import {
  addFloater,
  duplicateFloater,
  removeFloater,
  resetFloaters,
  updateFloater,
  useFloaters,
  type Floater,
} from './floaters';
import { CheckField, NumberField, SliderField } from './fields';

/**
 * Secao FLUTUADORES do editor.
 *
 * Tudo o que atravessa o ceu: nuvem, bando de passaro, gaivota, bafo de
 * neblina. Da para acrescentar um flutuador novo, escolher o sprite, dizer
 * quantos existem ao mesmo tempo, DE ONDE e PARA ONDE eles vao, em quanto
 * tempo, com quanta variacao, e em que horas do dia eles aparecem.
 *
 * Coordenada e porcentagem da TELA: 0 e a borda esquerda (ou o topo) e 100 e a
 * direita (ou o pe). Sair de -25 e chegar a 125 faz o bicho entrar e sair de
 * cena por fora da tela, que e o que quase sempre se quer.
 */

/** So o que faz sentido flutuar: ceu, efeito e bicho de mar. */
const SPRITES = ASSET_LIST.filter((p) => /^(sky|fx|marine|props)\//.test(p));

function FloaterForm({ it }: { it: Floater }) {
  const set = (patch: Partial<Floater>) => updateFloater(it.id, patch);
  const horas = it.hours;

  return (
    <div className="emech-form">
      <label className="efield">
        NOME
        <input value={it.label} onChange={(e) => set({ label: e.target.value })} />
      </label>

      <label className="efield">
        SPRITE
        <select value={it.sprite} onChange={(e) => set({ sprite: e.target.value })}>
          {SPRITES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>

      <div className="eanim-label">QUANTOS E ONDE</div>
      <div className="efields">
        <NumberField label="QUANTOS" value={it.count} min={0} max={24} onChange={(v) => set({ count: Math.max(0, Math.min(24, Math.round(v))) })} suffix="ao mesmo tempo" />
        <NumberField label="SAI DE · X" value={it.fromX} onChange={(v) => set({ fromX: v })} suffix="% da largura" />
        <NumberField label="VAI ATÉ · X" value={it.toX} onChange={(v) => set({ toX: v })} suffix="% da largura" />
        <NumberField label="SAI DE · Y" value={it.fromY} onChange={(v) => set({ fromY: v })} suffix="% da altura" />
        <NumberField label="VAI ATÉ · Y" value={it.toY} onChange={(v) => set({ toY: v })} suffix="% da altura" />
        <NumberField label="ESPALHA NA ALTURA" value={it.spreadY} onChange={(v) => set({ spreadY: Math.max(0, v) })} suffix="± pontos" />
      </div>

      <div className="eanim-label">RITMO E APARÊNCIA</div>
      <div className="efields">
        <NumberField label="TRAVESSIA" value={it.seconds} step={10} onChange={(v) => set({ seconds: Math.max(2, v) })} suffix="segundos" />
        <SliderField label="VARIAÇÃO DA VELOCIDADE" value={it.secondsVar} min={0} max={0.9} onChange={(v) => set({ secondsVar: v })} />
        <NumberField label="TAMANHO" value={it.size} step={0.5} onChange={(v) => set({ size: Math.max(0.2, v) })} suffix="% da altura da tela" />
        <SliderField label="VARIAÇÃO DO TAMANHO" value={it.sizeVar} min={0} max={0.9} onChange={(v) => set({ sizeVar: v })} />
        <SliderField label="OPACIDADE" value={it.opacity} onChange={(v) => set({ opacity: v })} />
        <SliderField label="VARIAÇÃO DA OPACIDADE" value={it.opacityVar} min={0} max={0.9} onChange={(v) => set({ opacityVar: v })} />
      </div>

      <div className="efields">
        <CheckField label="ESPELHAR" value={it.flip} onChange={(v) => set({ flip: v })} hint="vira o sprite para o outro lado" />
        <CheckField label="ESCONDER" value={Boolean(it.hidden)} onChange={(v) => set({ hidden: v })} hint="some do céu sem sair da lista" />
      </div>

      <div className="eanim-label">EM QUE HORAS APARECE</div>
      <div className="ehours">
        {SKY_PHASES.map((p) => {
          const on = horas.length === 0 || horas.includes(p.id);
          return (
            <button
              key={p.id}
              className={`ebtn${on ? ' primary' : ''}`}
              onClick={() => {
                const base: SkyPhaseId[] = horas.length === 0 ? SKY_PHASES.map((x) => x.id) : horas;
                const next = base.includes(p.id) ? base.filter((h) => h !== p.id) : [...base, p.id];
                set({ hours: next.length === SKY_PHASES.length ? [] : next });
              }}
            >
              {p.name}
            </button>
          );
        })}
      </div>
      <div className="ehint">
        {horas.length === 0 ? 'Aparece em todas as horas do dia.' : `Aparece em ${horas.length} de ${SKY_PHASES.length} horas.`}
      </div>

      <div className="erow">
        <button className="ebtn" onClick={() => duplicateFloater(it.id)}>
          DUPLICAR
        </button>
        <button className="ebtn danger" onClick={() => removeFloater(it.id)}>
          APAGAR
        </button>
      </div>
    </div>
  );
}

export function FloatersPanel() {
  const { items } = useFloaters();
  const [sel, setSel] = useState<string | null>(items[0]?.id ?? null);
  const it = items.find((i) => i.id === sel) ?? null;

  return (
    <div className="editor-panel wide">
      <div className="etitle">FLUTUADORES · O QUE PASSA NO CÉU</div>

      <div className="emech-row">
        <button
          className="ebtn primary"
          onClick={() => {
            const novo = addFloater();
            setSel(novo.id);
          }}
        >
          + NOVO FLUTUADOR
        </button>
        <div className="grow" />
        <button
          className="ebtn danger"
          onClick={() => confirm('Voltar os flutuadores ao padrão?') && resetFloaters()}
        >
          RESETAR
        </button>
      </div>

      <div className="emech-list">
        {items.map((i) => (
          <button
            key={i.id}
            className={`eitem eitem-thumb${sel === i.id ? ' on' : ''}${i.hidden ? ' locked' : ''}`}
            onClick={() => setSel(i.id)}
          >
            <span className="ethumb">
              <img src={asset(i.sprite)} alt="" />
            </span>
            <span className="grow">{i.label}</span>
            <small>{i.count}×</small>
            <span
              className="mini"
              onClick={(e) => {
                e.stopPropagation();
                updateFloater(i.id, { hidden: !i.hidden });
              }}
            >
              {i.hidden ? 'MOSTRAR' : 'ESCONDER'}
            </span>
          </button>
        ))}
      </div>

      {it ? <FloaterForm it={it} /> : <div className="ehint">Escolha um flutuador na lista.</div>}
    </div>
  );
}
