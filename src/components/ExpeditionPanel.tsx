import { EXPEDITION, expeditionReady } from '../data/expedition';
import { playSfx } from '../engine/audio';
import { claimExpedition, useGame } from '../state/store';
import { Sprite } from './Sprite';

export function ExpeditionApp() {
  const state = useGame();
  const chapter = EXPEDITION[state.expeditionChapter];
  const ready = expeditionReady(state);

  if (!chapter) {
    return (
      <div className="expedition-finale">
        <Sprite path="fx/reward-glow" size={100} />
        <h2>MESTRE DA MARÉ</h2>
        <p>Você atravessou a enseada, limpou o recife, resgatou o naufrágio e encontrou uma lenda nas águas profundas.</p>
        <p>O clube continua aberto. Ainda há espécies, recordes e encomendas esperando por você.</p>
        <strong>EXPEDIÇÃO CONCLUÍDA</strong>
      </div>
    );
  }

  return (
    <div className="expedition-app">
      <div className="expedition-map">{EXPEDITION.map((_, i) => <span key={i} className={i <= state.expeditionChapter ? 'lit' : ''}>{i + 1}</span>)}</div>
      <h2>{chapter.title}</h2>
      <p>{chapter.story}</p>
      <div className="expedition-tasks">
        {chapter.tasks.map((task) => {
          const count = Math.min(task.goal, task.count(state));
          return (
            <div className="expedition-task" key={task.label}>
              <span>{count === task.goal ? '✓' : '○'} {task.label}</span>
              <strong>{count}/{task.goal}</strong>
              <i><b style={{ width: `${count / task.goal * 100}%` }} /></i>
            </div>
          );
        })}
      </div>
      <div className="expedition-reward">RECOMPENSA · {chapter.reward.coins.toLocaleString('pt-BR')} SZ{chapter.reward.eyes ? ` · ${chapter.reward.eyes} Olhos` : ''}</div>
      <button className="btn primary" disabled={!ready} onClick={() => { if (claimExpedition()) playSfx('unlock'); }}>
        {ready ? 'CONCLUIR ETAPA' : 'CONTINUE EXPLORANDO'}
      </button>
    </div>
  );
}
