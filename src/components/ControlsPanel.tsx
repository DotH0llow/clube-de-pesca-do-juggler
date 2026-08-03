
const STEPS = [
  {
    n: '1',
    title: 'Lançar',
    touch: 'Toque em LANÇAR e depois em qualquer lugar da barra para travar.',
    keys: 'Espaço ou Enter',
    tip: 'Travar na faixa dourada do meio vale lançamento perfeito: mais chance de peixe bom e +15% no valor da venda.',
  },
  {
    n: '2',
    title: 'Esperar',
    touch: 'Nada a fazer. A boia fica na água por um tempo aleatório.',
    keys: '-',
    tip: 'Se voltar vazio, o jogo compensa: cada lançamento seco aumenta a chance do próximo dar peixe.',
  },
  {
    n: '3',
    title: 'Fisgar',
    touch: 'Toque em FISGAR! assim que a boia mexer.',
    keys: 'Espaço ou Enter',
    tip: 'A janela é de pouco mais de um segundo. Perdeu, perdeu o peixe.',
  },
  {
    n: '4',
    title: 'Puxar',
    touch: 'Segure o dedo na tela para a faixa verde subir, solte para descer.',
    keys: 'Segurar Espaço',
    tip: 'Mantenha o vulto do peixe dentro da faixa para encher a barra da direita. Peixe raro se debate mais.',
  },
  {
    n: '5',
    title: 'Vender e colecionar',
    touch: 'O peixe vira Sazoncoins e entra no Álbum automaticamente.',
    keys: 'Espaço lança de novo',
    tip: 'Cada espécie nova guarda seu recorde de peso e tamanho. Família completa paga prêmio.',
  },
];

export function ControlsApp() {
  return (
    <>
      <div className="row">
        <div className="grow desc">
          Cinco passos. Dá para jogar só com a barra de espaço ou só com o dedo.
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
            Moeda comum. Vem de peixe vendido, lixo, baús e conquistas. Paga upgrades e melhorias.
          </div>
        </div>
      </div>
      <div className="row">
        <div className="grow">
          <div className="title" style={{ color: 'var(--eye)' }}>
            Olhos da Hydra
          </div>
          <div className="desc">
            Moeda de prestígio. Vem de peixe épico pra cima, baús, Eventos Hydra e conquistas. So o Altar
            da Hydra aceita.
          </div>
        </div>
      </div>

      <div className="section-title">Ciclo do dia</div>
      <div className="row">
        <div className="grow desc">
          O dia no cais dura 24 minutos e não para: manhã, tarde de temporal, entardecer e madrugada,
          6 minutos cada. Cada fase tem um teto de raridade — de manhã não sai lendário nenhum, por
          mais que você pesque. Esperar a fase virar é o que abre raridade nova. O celular mostra que
          horas são na aba CICLO DO DIA.
        </div>
      </div>
    </>
  );
}
