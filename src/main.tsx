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

/*
 * O BOTÃO DIREITO É DO JOGO, não do navegador.
 *
 * O editor já usa o direito para abrir o menu de contexto do objeto, e o menu
 * do Firefox abria por cima dele - "Recarregar", "Salvar como", "Criar QR
 * Code". Dentro do jogo era pior: o direito não faz nada e o menu do navegador
 * aparecia mesmo assim, no meio da pescaria.
 *
 * O bloqueio é na janela inteira e não em cada componente, porque a lista de
 * componentes cresce e um `onContextMenu` esquecido em qualquer um deles traz
 * o menu de volta. As exceções são os campos de TEXTO: ali o menu do navegador
 * é útil de verdade (copiar, colar, corrigir), e o editor tem campo de texto
 * em três painéis.
 */
window.addEventListener('contextmenu', (e) => {
  const alvo = e.target as HTMLElement | null;
  if (alvo?.closest('input, textarea, [contenteditable="true"]')) return;
  e.preventDefault();
});

const el = document.getElementById('root');
if (!el) throw new Error('#root não encontrado');

createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
