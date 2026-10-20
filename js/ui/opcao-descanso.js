// Escolha "com ou sem timer de descanso" na hora de iniciar o treino.
// Lembra a última escolha. Quem usa um relógio por fora liga o modo sem timer
// e só registra carga e repetições.

import { getConfig, setConfig } from '../db/db.js';
import { $ } from './dom.js';

export const HTML_OPCAO_DESCANSO = `
  <div class="linha-descanso" id="opcao-descanso">
    <div class="item-texto">
      <div class="item-titulo">Timer de descanso</div>
      <div class="item-sub" data-estado></div>
    </div>
    <button type="button" class="interruptor" role="switch" aria-checked="true" aria-label="Timer de descanso"><span></span></button>
  </div>`;

/** Liga o interruptor dentro de `raiz`. Devolve uma função que diz se o descanso está ligado. */
export function ligarOpcaoDescanso(raiz) {
  const el = $('#opcao-descanso', raiz);
  const botao = $('.interruptor', el);
  let ligado = true;
  const mostrar = () => {
    botao.setAttribute('aria-checked', String(ligado));
    $('[data-estado]', el).textContent = ligado ? 'Conta o descanso entre as séries' : 'Desligado: só carga e repetições';
  };
  mostrar();
  getConfig('descanso_ligado', true).then((v) => { ligado = v !== false; mostrar(); }).catch(() => {});
  botao.onclick = () => {
    ligado = !ligado;
    mostrar();
    setConfig('descanso_ligado', ligado).catch(() => {});
  };
  return () => ligado;
}
