import { useState } from 'react';
import { initAudio, playCatch, playSfx, startAmbience, stopAmbience } from '../engine/audio';
import { resetGame, useGame } from '../state/store';
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
      <div className="section-title">Audio</div>
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
        label="Musica e ambiencia"
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

      <div className="section-title">Imagem e animacao</div>
      <Toggle
        label="Animacoes"
        desc="Ondas, boia balancando, transicoes e brilho dos popups."
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
        desc="Pede confirmacao antes de gastar Olhos da Hydra."
        value={s.confirmEyes}
        onChange={(v) => patch({ confirmEyes: v })}
      />

      <div className="section-title">Dados</div>
      <div className="row">
        <div className="grow">
          <div className="title">Progresso atual</div>
          <div className="desc">
            {game.stats.casts.toLocaleString('pt-BR')} lancamentos &middot;{' '}
            {Object.keys(game.album).length} especies &middot; {game.achievements.length} conquistas
          </div>
        </div>
      </div>
      <div className="row">
        <div className="grow">
          <div className="title">Restaurar configuracoes</div>
          <div className="desc">Volta som, animacoes e ajudas para o padrao. Nao mexe no progresso.</div>
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
              ? 'Isso apaga album, moedas, upgrades e conquistas. Nao tem volta.'
              : 'Comeca tudo de novo, do zero.'}
          </div>
        </div>
        {confirmWipe ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn small ghost" onClick={() => setConfirmWipe(false)}>
              NAO
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
