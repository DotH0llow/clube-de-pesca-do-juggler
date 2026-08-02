import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { asset } from './assets';
import './styles/global.css';

/**
 * As molduras do kit entram como border-image via CSS vars: o Vite versiona
 * os arquivos, entao a URL final so existe em tempo de execucao.
 */
const root = document.documentElement.style;
root.setProperty('--btn-frame', `url("${asset('ui/button')}")`);
root.setProperty('--panel-frame', `url("${asset('ui/decorative-frame')}")`);
root.setProperty('--banner-frame', `url("${asset('fx/capture-banner')}")`);

const el = document.getElementById('root');
if (!el) throw new Error('#root nao encontrado');

createRoot(el).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
