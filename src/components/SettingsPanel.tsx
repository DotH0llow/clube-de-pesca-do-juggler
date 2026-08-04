import { useState } from 'react';
import { initAudio, playCatch, playSfx, startAmbience, stopAmbience } from '../engine/audio';
import { resetDays, resetGame, useGame } from '../state/store';
import { buzz, resetSettings, updateSettings, useSettings, type Settings } from '../state/settings';

function Toggle({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="row">
      <div className="grow">
        <div className="title">{label}</div>
        <div className="desc">{desc}</div>
      </div>
      <button
        className={`btn small${value ? ' primary' : ''}`}
        onClick={() => {
          playSfx('ui');
          onChange(!value);
        }}
        aria-pressed={value}
      >
        {value ? 'LIGADO' : 'DESLIGADO'}
      </button>
    </div>
  );
}

function Slider({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div className="row">
      <div className="grow">
        <div className="title">
          {label} <span style={{ opacity: 0.6 }}>{Math.round(value * 100)}%</span>
        </div>
        <input
          className="range"
          type="range"
          min={0}
          max={100}
          step={5}
          value={Math.round(value * 100)}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          aria-label={label}
        />
      </div>
    </div>
  );
}

export function SettingsApp() {
  const s = useSettings();
  const game = useGame();
  const [confirmWipe, setConfirmWipe] = useState(false);

  const patch = (p: Partial<Settings>) => updateSettings(p);

  return (
    <>
      <div className="section-title">O clube</div>
      <div className="row">
        <div className="grow">
          <div className="title">Dia {game.dia}</div>
          <div className="desc">
            O contador sobe quando você encerra o dia no cais. Resetar volta para o dia 1 e não
            mexe em mais nada — peixe, moeda e álbum ficam como estão.
          </div>
        </div>
        <button className="btn ghost small" onClick={() => resetDays()} disabled={game.dia === 1}>
          RESETAR
        </button>
      </div>

      <div className="section-title">Áudio</div>
      <Toggle
        label="Silenciar tudo"
        desc="Corta o som sem perder os volumes ajustados."
        value={s.muted}
        onChange={(v) => {
          patch({ muted: v });
          if (!v) initAudio();
        }}
      />
      <Slider label="Volume geral" value={s.master} disabled={s.muted} onChange={(v) => patch({ master: v })} />
      <Slider
        label="Música e ambiência"
        value={s.music}
        disabled={s.muted}
        onChange={(v) => {
          patch({ music: v });
          if (v > 0) {
            initAudio();
            startAmbience();
          } else {
            stopAmbience();
          }
        }}
      />
      <Slider label="Efeitos sonoros" value={s.sfx} disabled={s.muted} onChange={(v) => patch({ sfx: v })} />
      <div className="row">
        <div className="grow desc">
          O som e gerado na hora pelo navegador, sem arquivo de audio. Trilha e efeitos definitivos entram depois.
        </div>
        <button
          className="btn small"
          onClick={() => {
            initAudio();
            playCatch('raro');
          }}
        >
          TESTAR
        </button>
      </div>

      <div className="section-title">Imagem e animação</div>
      <Toggle
        label="Animacoes"
        desc="Ondas, boia balançando, transições e brilho dos popups."
        value={s.animations}
        onChange={(v) => patch({ animations: v })}
      />
      <Toggle
        label="Tremor de tela"
        desc="A boia e a tela sacodem quando o peixe morde."
        value={s.screenShake}
        onChange={(v) => patch({ screenShake: v })}
      />

      <div className="section-title">Jogo</div>
      <Toggle
        label="Dicas na tela"
        desc="Mostra o que fazer em cada etapa da pescaria."
        value={s.hints}
        onChange={(v) => patch({ hints: v })}
      />
      <Toggle
        label="Vibracao"
        desc="Vibra no celular na mordida e na captura. Sem efeito no PC."
        value={s.haptics}
        onChange={(v) => {
          patch({ haptics: v });
          if (v) buzz(20);
        }}
      />
      <Toggle
        label="Confirmar gasto de Olhos"
        desc="Pede confirmação antes de gastar Olhos da Hydra."
        value={s.confirmEyes}
        onChange={(v) => patch({ confirmEyes: v })}
      />

      <div className="section-title">Dados</div>
      <div className="row">
        <div className="grow">
          <div className="title">Progresso atual</div>
          <div className="desc">
            {game.stats.casts.toLocaleString('pt-BR')} lançamentos &middot;{' '}
            {Object.keys(game.album).length} espécies &middot; {game.achievements.length} conquistas
          </div>
        </div>
      </div>
      <div className="row">
        <div className="grow">
          <div className="title">Restaurar configurações</div>
          <div className="desc">Volta som, animações e ajudas para o padrão. Não mexe no progresso.</div>
        </div>
        <button
          className="btn small"
          onClick={() => {
            resetSettings();
            playSfx('ui');
          }}
        >
          RESTAURAR
        </button>
      </div>
      <div className="row">
        <div className="grow">
          <div className="title" style={{ color: '#ff8fa3' }}>
            Apagar progresso
          </div>
          <div className="desc">
            {confirmWipe
              ? 'Isso apaga álbum, moedas, upgrades e conquistas. Não tem volta.'
              : 'Começa tudo de novo, do zero.'}
          </div>
        </div>
        {confirmWipe ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn small ghost" onClick={() => setConfirmWipe(false)}>
              NÃO
            </button>
            <button
              className="btn small danger"
              onClick={() => {
                resetGame();
                setConfirmWipe(false);
                playSfx('fail');
              }}
            >
              APAGAR
            </button>
          </div>
        ) : (
          <button className="btn small danger" onClick={() => setConfirmWipe(true)}>
            APAGAR
          </button>
        )}
      </div>
    </>
  );
}
