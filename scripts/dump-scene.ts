/**
 * Despeja a cena semeada em JSON, para conferir GEOMETRIA sem abrir o navegador.
 *
 * O cais e montado por conta - uma tabua atras da outra, estaca a cada tantas
 * unidades, testeira encostando no piso - e conta de encaixe erra calada: nada
 * quebra, o build passa, e a peca fica dois pixels fora do lugar. Este dump
 * alimenta o `scripts/render-scene.py`, que desenha a cena num PNG usando os
 * MESMOS sprites e as MESMAS coordenadas que o jogo usa.
 *
 *   npm run cena
 */
import { seedScene } from '../src/editor/scene';

const cena = {
  mundo: seedScene('mundo'),
  menu: seedScene('menu'),
};

process.stdout.write(JSON.stringify(cena, null, 2));
