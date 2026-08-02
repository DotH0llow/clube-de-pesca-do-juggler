
const STEPS = [
  {
    n: '1',
    title: 'Lancar',
    touch: 'Toque em LANCAR e depois em qualquer lugar da barra para travar.',
    keys: 'Espaco ou Enter',
    tip: 'Travar na faixa dourada do meio vale lancamento perfeito: mais chance de peixe bom e +15% no valor da venda.',
  },
  {
    n: '2',
    title: 'Esperar',
    touch: 'Nada a fazer. A boia fica na agua por um tempo aleatorio.',
    keys: '-',
    tip: 'Se voltar vazio, o jogo compensa: cada lancamento seco aumenta a chance do proximo dar peixe.',
  },
  {
    n: '3',
    title: 'Fisgar',
    touch: 'Toque em FISGAR! assim que a boia mexer.',
    keys: 'Espaco ou Enter',
    tip: 'A janela e de pouco mais de um segundo. Perdeu, perdeu o peixe.',
  },
  {
    n: '4',
    title: 'Puxar',
    touch: 'Segure o dedo na tela para a faixa verde subir, solte para descer.',
    keys: 'Segurar Espaco',
    tip: 'Mantenha o vulto do peixe dentro da faixa para encher a barra da direita. Peixe raro se debate mais.',
  },
  {
    n: '5',
    title: 'Vender e colecionar',
    touch: 'O peixe vira Sazoncoins e entra no Album automaticamente.',
    keys: 'Espaco lanca de novo',
    tip: 'Cada especie nova guarda seu recorde de peso e tamanho. Familia completa paga premio.',
  },
];

export function ControlsApp() {
  return (
    <>
      <div className="row">
        <div className="grow desc">
          Cinco passos. Da para jogar so com a barra de espaco ou so com o dedo.
        </div>
      </div>

      {STEPS.map((s) => (
        <div className="row" key={s.n}>
          <div className="step-number">{s.n}</div>
          <div className="grow">
            <div className="title">{s.title}</div>
            <div className="desc">
              <strong style={{ color: 'var(--neon)' }}>Toque:</strong> {s.touch}
            </div>
            <div className="desc">
              <strong style={{ color: 'var(--neon)' }}>Teclado:</strong> {s.keys}
            </div>
            <div className="desc" style={{ opacity: 0.6 }}>
              {s.tip}
            </div>
          </div>
        </div>
      ))}

      <div className="section-title">Moedas</div>
      <div className="row">
        <div className="grow">
          <div className="title" style={{ color: 'var(--coin)' }}>
            Sazoncoins
          </div>
          <div className="desc">
            Moeda comum. Vem de peixe vendido, lixo, baus e conquistas. Paga upgrades e pesqueiros novos.
          </div>
        </div>
      </div>
      <div className="row">
        <div className="grow">
          <div className="title" style={{ color: 'var(--eye)' }}>
            Olhos da Hydra
          </div>
          <div className="desc">
            Moeda de prestigio. Vem de peixe epico pra cima, baus, Eventos Hydra e conquistas. So o Altar
            da Hydra aceita.
          </div>
        </div>
      </div>

      <div className="section-title">Pesqueiros</div>
      <div className="row">
        <div className="grow desc">
          Cada pesqueiro tem um teto de raridade. A Enseada do Coral nao tem lendario nenhum, por mais
          que voce pesque. Trocar de regiao no CAIS e o que abre raridade nova.
        </div>
      </div>
    </>
  );
}
