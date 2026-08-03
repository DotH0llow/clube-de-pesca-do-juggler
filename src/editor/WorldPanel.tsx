import {
  resetWorld,
  seaBottom,
  seaLeft,
  seedWorld,
  updateWorld,
  useWorld,
} from '../world/worldConfig';
import { SKY_PHASES, type SkyPhaseId } from '../data/skies';
import { NumberField, SliderField } from './fields';

/**
 * Secao MUNDO do editor.
 *
 * O que este painel mexe nao e objeto de cena: e a PLANTA. Linha d'agua,
 * profundidade e largura do mar, faixa de areia, piso do deck, ritmo das ondas
 * e - o mais importante - o ENQUADRAMENTO, que e como a camera decide quanto de
 * mar cabe na tela dos dois lados do limiar do pier.
 *
 * Tudo aqui vale na hora, no jogo de verdade.
 */
export function WorldPanel() {
  const w = useWorld();
  const seed = seedWorld();

  const pct = (v: number, base: number) => `${Math.round((v / base) * 100)}% do padrão`;

  return (
    <div className="editor-panel wide">
      <div className="etitle">MUNDO · PLANTA DO CENÁRIO</div>

      <div className="eanim-label">MAR</div>
      <div className="efields">
        <NumberField
          label="LINHA D'ÁGUA"
          value={w.waterY}
          onChange={(v) => updateWorld({ waterY: v })}
          suffix="acima é céu, abaixo é mar"
        />
        <NumberField
          label="PROFUNDIDADE"
          value={w.seaDepth}
          step={50}
          onChange={(v) => updateWorld({ seaDepth: Math.max(80, v) })}
          suffix={pct(w.seaDepth, seed.seaDepth)}
        />
        <NumberField
          label="LARGURA DA ÁGUA"
          value={w.seaWidth}
          step={100}
          onChange={(v) => updateWorld({ seaWidth: Math.max(400, v) })}
          suffix={pct(w.seaWidth, seed.seaWidth)}
        />
        <NumberField
          label="ENCONTRO COM A AREIA"
          value={w.shoreX}
          step={10}
          onChange={(v) => updateWorld({ shoreX: v })}
          suffix="X onde a água acaba"
        />
      </div>
      <div className="ehint">
        A água vai de {Math.round(seaLeft())} até {Math.round(w.shoreX)} e desce até{' '}
        {Math.round(seaBottom())}. O que está lá embaixo quase nunca aparece: a câmera fica na
        superfície e só abre quando o Juggler passa o limiar do píer.
      </div>

      <div className="eanim-label">TERRA</div>
      <div className="efields">
        <NumberField
          label="TOPO DA AREIA"
          value={w.sandY}
          onChange={(v) => updateWorld({ sandY: v })}
          suffix="o chão da praia"
        />
        <NumberField
          label="ALTURA DA AREIA"
          value={w.sandDepth}
          step={5}
          onChange={(v) => updateWorld({ sandDepth: Math.max(10, v) })}
          suffix={pct(w.sandDepth, seed.sandDepth)}
        />
        <NumberField
          label="PISO DO DECK"
          value={w.pierY}
          onChange={(v) => updateWorld({ pierY: v })}
          suffix="o chão do píer"
        />
      </div>

      <div className="eanim-label">ENQUADRAMENTO</div>
      <div className="efields">
        <NumberField
          label="ALTURA DA MOLDURA"
          value={w.frameH}
          step={10}
          onChange={(v) => updateWorld({ frameH: Math.max(200, v) })}
          suffix="unidades que cabem na tela"
        />
        <SliderField
          label="ALTURA DA LINHA D'ÁGUA NA TELA"
          value={w.waterAnchor}
          min={0.1}
          max={0.9}
          onChange={(v) => updateWorld({ waterAnchor: v })}
        />
        <SliderField
          label="NO LADO DA PRAIA"
          value={w.frameLand}
          min={0.3}
          max={1.6}
          onChange={(v) => updateWorld({ frameLand: v })}
          suffix="× de zoom"
        />
        <SliderField
          label="NO LADO DO MAR"
          value={w.frameSea}
          min={0.2}
          max={1.6}
          onChange={(v) => updateWorld({ frameSea: v })}
          suffix="× de zoom"
        />
        <NumberField
          label="TEMPO DA VIRADA"
          value={w.frameEase}
          step={0.1}
          onChange={(v) => updateWorld({ frameEase: Math.max(0, v) })}
          suffix="segundos"
        />
      </div>
      <div className="ehint">
        Menor no lado do mar = câmera mais aberta = mais água na tela. A virada acontece no objeto
        LIMIAR DO PÍER, na camada INTERAGÍVEIS - arraste a caixa dele para escolher onde exatamente
        a tela abre e fecha.
      </div>

      <div className="eanim-label">ONDAS</div>
      <div className="efields">
        <NumberField
          label="ALTURA DA FAIXA"
          value={w.waveH}
          onChange={(v) => updateWorld({ waveH: Math.max(8, v) })}
        />
        <NumberField
          label="SOBE ACIMA DA ÁGUA"
          value={w.waveLift}
          onChange={(v) => updateWorld({ waveLift: v })}
        />
        <SliderField label="ESPUMA" value={w.foamOpacity} onChange={(v) => updateWorld({ foamOpacity: v })} />
        <SliderField label="ONDA" value={w.swellOpacity} onChange={(v) => updateWorld({ swellOpacity: v })} />
        <SliderField label="BRILHO DO SOL" value={w.glintOpacity} onChange={(v) => updateWorld({ glintOpacity: v })} />
        <NumberField
          label="RITMO DA ONDA"
          value={w.swellSeconds}
          step={0.5}
          onChange={(v) => updateWorld({ swellSeconds: Math.max(1, v) })}
          suffix="segundos por passada"
        />
        <NumberField
          label="RITMO DA ESPUMA"
          value={w.foamSeconds}
          step={0.5}
          onChange={(v) => updateWorld({ foamSeconds: Math.max(1, v) })}
          suffix="segundos por passada"
        />
      </div>

      <div className="eanim-label">TELA DE TÍTULO</div>
      <label className="efield">
        HORA DO MENU
        <select value={w.menuHour} onChange={(e) => updateWorld({ menuHour: e.target.value as SkyPhaseId })}>
          {SKY_PHASES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <div className="ehint">
        O menu não segue mais o relógio do jogo: ele fica nesta hora sempre. Abrir o jogo de
        madrugada não muda a tela de título.
      </div>

      <button
        className="ebtn danger"
        onClick={() => confirm('Voltar a planta do mundo ao padrão?') && resetWorld()}
      >
        RESETAR O MUNDO
      </button>
    </div>
  );
}
