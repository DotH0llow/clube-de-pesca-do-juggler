import { Panel } from './Panel';

export function CreditsPanel({ onClose }: { onClose: () => void }) {
  return (
    <Panel title="Creditos" onClose={onClose}>
      <div className="row">
        <div className="grow">
          <div className="title">Clube de Pesca do Juggler</div>
          <div className="desc">
            Jogo casual de pesca do universo Hydra. Irmao menor do Hydrinho Lucky Spin.
          </div>
        </div>
      </div>
      <div className="row">
        <div className="grow">
          <div className="title">O Fundador</div>
          <div className="desc">
            Chapeu de palha, oculos escuros e uma placa de bronze no peito. Fundou o clube, nunca
            explicou o porque e continua sentado no cais.
          </div>
        </div>
      </div>
      <div className="row">
        <div className="grow">
          <div className="title">Sobre o som</div>
          <div className="desc">
            Todo o audio e gerado ao vivo pelo navegador com WebAudio: ondas, efeitos e fanfarras de
            captura. Nenhum arquivo de musica foi usado.
          </div>
        </div>
      </div>
      <div className="row">
        <div className="grow">
          <div className="title">Universo Hydra</div>
          <div className="desc">
            Sazoncoins, Olhos da Hydra e o Altar vem do Hydrinho Lucky Spin. O Hydrinho mora la no
            fundo da Fossa - e sim, ele aparece.
          </div>
        </div>
      </div>
    </Panel>
  );
}
