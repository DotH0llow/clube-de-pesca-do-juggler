import { ACHIEVEMENT_CATEGORY_LABEL, ACHIEVEMENTS } from '../data/achievements';
import { useGame } from '../state/store';
import { Panel } from './Panel';
import { Sprite } from './Sprite';

export function AchievementsPanel({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const done = s.achievements.length;

  return (
    <Panel
      title="Conquistas"
      onClose={onClose}
      right={
        <span style={{ fontSize: 11 }}>
          {done}/{ACHIEVEMENTS.length}
        </span>
      }
    >
      {ACHIEVEMENTS.map((a) => {
        const unlocked = s.achievements.includes(a.id);
        const raw = a.progress(s);
        const pct = Math.min(100, (raw / a.goal) * 100);
        const hidden = a.secret && !unlocked;
        return (
          <div className="row" key={a.id}>
            <Sprite
              path={unlocked ? 'ui/ranking-icon' : 'ui/rarity-common'}
              size={32}
              style={{ opacity: unlocked ? 1 : 0.25, filter: unlocked ? undefined : 'grayscale(1)' }}
            />
            <div className="grow">
              <div className="title" style={{ color: unlocked ? 'var(--coin)' : undefined }}>
                {hidden ? '???' : a.name}
              </div>
              <div className="desc">
                {hidden ? 'Conquista secreta.' : a.desc}{' '}
                <span style={{ opacity: 0.6 }}>[{ACHIEVEMENT_CATEGORY_LABEL[a.category]}]</span>
              </div>
              {!unlocked && (
                <>
                  <div className="bar">
                    <div className="fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="desc">
                    {Math.min(Math.floor(raw), a.goal).toLocaleString('pt-BR')} /{' '}
                    {a.goal.toLocaleString('pt-BR')}
                  </div>
                </>
              )}
              {a.reward && (
                <div className="desc" style={{ color: 'var(--neon)' }}>
                  Premio: {a.reward.sazoncoins ? `${a.reward.sazoncoins} SZ` : ''}
                  {a.reward.sazoncoins && a.reward.hydraEyes ? ' + ' : ''}
                  {a.reward.hydraEyes ? `${a.reward.hydraEyes} Olhos` : ''}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </Panel>
  );
}
