import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { asset } from './assets';
import './styles/global.css';

/**
 * As molduras do kit entram como border-image via CSS vars: o Vite versiona
 * os arquivos, então a URL final so existe em tempo de execucao.
 */
const root = document.documentElement.style;
root.setProperty('--btn-frame', `url("${asset('ui/button')}")`);
/*
 * A moldura das janelas e de MADEIRA, montada com as tabuas do pier.
 *
 * Era `ui/decorative-frame`, uma moldura de folhagem tropical usada com
 * `border-image-slice: 46 fill`. O `fill` manda o centro da imagem preencher o
 * fundo do elemento - e o centro daquela arte e a propria folhagem, entao toda
 * janela do jogo virava um mosaico de folhas repetidas atras do texto.
 *
 * A nova (`scripts/frames.py`) tem o centro VAZIO: quem pinta o fundo e o CSS,
 * e por isso da para trocar a cor da janela sem reexportar imagem.
 */
root.setProperty('--panel-frame', `url("${asset('ui/window-frame')}")`);
root.setProperty('--banner-frame', `url("${asset('ui/window-title')}")`);

const el = document.getElementById('root');
if (!el) throw new Error('#root não encontrado');

createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
