import { REGIONS } from '../data/regions';
import type { CastResult, RegionId } from '../state/types';
import type { Phase } from '../hooks/useFishingLoop';
import { FishSprite } from './FishSprite';

interface Props {
  region: RegionId;
  phase: Phase;
  pending: CastResult | null;
}

/**
 * Cena de fundo inteira em SVG: ceu, sol, ilhas de calcario, mar, barco,
 * linha e boia. A paleta vem da regiao selecionada.
 */
export function Scene({ region, phase, pending }: Props) {
  const p = REGIONS[region].palette;
  const inWater = phase === 'waiting' || phase === 'bite' || phase === 'reeling';
  const biting = phase === 'bite' || phase === 'reeling';
  const night = region === 'fossa';

  return (
    <svg
      className="stage"
      viewBox="0 0 320 180"
      preserveAspectRatio="xMidYMid slice"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.skyTop} />
          <stop offset="100%" stopColor={p.skyBottom} />
        </linearGradient>
        <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.seaTop} />
          <stop offset="100%" stopColor={p.seaBottom} />
        </linearGradient>
        <linearGradient id="glare" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.sun} stopOpacity="0.5" />
          <stop offset="100%" stopColor={p.sun} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* ceu */}
      <rect x="0" y="0" width="320" height="96" fill="url(#sky)" />

      {/* sol / lua */}
      <g>
        <circle cx="238" cy="34" r="16" fill={p.sun} opacity="0.9" />
        <circle cx="238" cy="34" r="26" fill={p.sun} opacity="0.16" />
      </g>

      {/* nuvens chapadas */}
      {!night && (
        <g fill="#ffffff" opacity="0.55">
          <rect x="24" y="20" width="34" height="5" />
          <rect x="30" y="15" width="22" height="5" />
          <rect x="128" y="34" width="42" height="5" />
          <rect x="136" y="29" width="24" height="5" />
          <rect x="266" y="58" width="30" height="4" />
        </g>
      )}
      {night && (
        <g fill="#ffffff" opacity="0.8">
          <rect x="40" y="18" width="2" height="2" />
          <rect x="88" y="30" width="2" height="2" />
          <rect x="150" y="14" width="2" height="2" />
          <rect x="196" y="44" width="2" height="2" />
          <rect x="286" y="26" width="2" height="2" />
          <rect x="66" y="52" width="2" height="2" />
        </g>
      )}

      {/* ilhas de calcario ao fundo */}
      <g>
        <polygon points="0,96 8,58 22,44 34,52 44,40 58,60 66,96" fill={p.island} />
        <polygon points="34,52 44,40 58,60 48,96 30,96" fill={p.islandShade} opacity="0.55" />
        <polygon points="248,96 258,54 270,42 284,50 296,36 312,58 320,96" fill={p.island} />
        <polygon points="284,50 296,36 312,58 306,96 286,96" fill={p.islandShade} opacity="0.55" />
        <polygon points="96,96 104,74 116,66 128,76 138,96" fill={p.island} opacity="0.75" />
        {/* vegetacao no topo */}
        {!night && (
          <g fill="#3f7d43" opacity="0.85">
            <rect x="18" y="42" width="10" height="4" />
            <rect x="40" y="38" width="8" height="4" />
            <rect x="266" y="40" width="10" height="4" />
            <rect x="292" y="34" width="8" height="4" />
            <rect x="108" y="64" width="10" height="4" />
          </g>
        )}
      </g>

      {/* neblina do horizonte */}
      <rect x="0" y="84" width="320" height="14" fill={p.haze} opacity="0.35" />

      {/* mar */}
      <rect x="0" y="96" width="320" height="84" fill="url(#sea)" />
      <rect x="200" y="96" width="80" height="60" fill="url(#glare)" opacity="0.7" />

      {/* ondas */}
      <g className="waves-a" fill="#ffffff" opacity="0.22">
        <rect x="10" y="106" width="16" height="2" />
        <rect x="60" y="116" width="22" height="2" />
        <rect x="140" y="110" width="18" height="2" />
        <rect x="212" y="122" width="26" height="2" />
        <rect x="280" y="112" width="16" height="2" />
      </g>
      <g className="waves-b" fill="#ffffff" opacity="0.16">
        <rect x="34" y="134" width="26" height="2" />
        <rect x="112" y="146" width="30" height="2" />
        <rect x="196" y="138" width="22" height="2" />
        <rect x="262" y="152" width="28" height="2" />
      </g>

      {/* sombra da Hydra no fundo da fossa */}
      {night && (
        <g opacity="0.8">
          <circle cx="70" cy="158" r="2" fill="#ff2e4d" />
          <circle cx="80" cy="158" r="2" fill="#ff2e4d" />
          <circle cx="104" cy="166" r="2" fill="#ff2e4d" />
          <circle cx="114" cy="166" r="2" fill="#ff2e4d" />
        </g>
      )}

      {/* linha, boia e o que estiver preso nela */}
      {inWater && (
        <g>
          <line x1="232" y1="118" x2="150" y2="126" stroke="#ffffff" strokeWidth="1" opacity="0.75" />
          <g className={biting ? 'shaking' : 'bobbing'}>
            <rect x="146" y="122" width="8" height="4" fill="#ff3b3b" />
            <rect x="146" y="126" width="8" height="4" fill="#f4f4f4" />
            <rect x="149" y="118" width="2" height="4" fill="#2b2b2b" />
          </g>
          {biting && (
            <g opacity="0.45">
              <ellipse cx="150" cy="140" rx="20" ry="6" fill="#02121b" />
            </g>
          )}
          {phase === 'reeling' && pending?.fish && (
            <g transform="translate(126,132)" opacity="0.9">
              <FishSprite fish={pending.fish} size={22} flip />
            </g>
          )}
        </g>
      )}

      {/* barco do clube, ancorado a direita */}
      <g>
        {/* toldo */}
        <rect x="238" y="96" width="66" height="6" fill="#ffcf4d" />
        <rect x="238" y="102" width="66" height="3" fill="#e0a020" />
        <rect x="240" y="105" width="3" height="18" fill="#d8d8d8" />
        <rect x="300" y="105" width="3" height="18" fill="#d8d8d8" />
        {/* pescador */}
        <rect x="262" y="106" width="10" height="14" fill="#ff4d6d" />
        <rect x="263" y="100" width="8" height="7" fill="#e8b98a" />
        <rect x="262" y="98" width="10" height="3" fill="#2f3b45" />
        <rect x="272" y="110" width="2" height="2" fill="#e8b98a" />
        {/* vara */}
        <line x1="272" y1="110" x2="234" y2="116" stroke="#3b2b1a" strokeWidth="2" />
        {/* casco */}
        <rect x="226" y="123" width="94" height="14" fill="#f2f7fa" />
        <rect x="226" y="130" width="94" height="7" fill="#2fa8d8" />
        <polygon points="226,123 226,137 214,133 214,127" fill="#f2f7fa" />
        {/* boias na lateral */}
        <g fill="#f5deb3">
          <rect x="234" y="128" width="7" height="7" />
          <rect x="248" y="128" width="7" height="7" />
          <rect x="262" y="128" width="7" height="7" />
          <rect x="276" y="128" width="7" height="7" />
        </g>
        {/* reflexo */}
        <rect x="222" y="137" width="98" height="3" fill="#02121b" opacity="0.25" />
      </g>
    </svg>
  );
}
