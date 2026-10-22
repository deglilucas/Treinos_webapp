// Pedaços de interface reaproveitados nas telas de edição.

import { esc } from './dom.js';
import { icone } from './icones.js';

/** Cabeçalho de subtela com botão de voltar. */
export function cabecalhoVoltar(titulo, destino, acaoDireita = '') {
  return `
    <header class="cabecalho-voltar">
      <a class="botao-icone" href="#/${esc(destino)}" aria-label="Voltar">${icone('voltar')}</a>
      <h1 class="titulo-sub">${esc(titulo)}</h1>
      ${acaoDireita}
    </header>`;
}

/**
 * Controle − valor +. Os botões levam data-campo e data-delta.
 * Com `editavel`, o valor vira um botão (data-editar) para digitar direto.
 */
export function stepper(campo, valorTexto, rotulo, editavel = false) {
  const valor = editavel
    ? `<button type="button" class="stepper-valor stepper-valor-editavel" data-editar="${campo}" aria-label="Digitar ${esc(rotulo)}">${esc(valorTexto)}</button>`
    : `<span class="stepper-valor">${esc(valorTexto)}</span>`;
  return `
    <div class="stepper" data-stepper="${campo}">
      <button type="button" class="stepper-botao" data-campo="${campo}" data-delta="-1" aria-label="Diminuir ${esc(rotulo)}">−</button>
      ${valor}
      <button type="button" class="stepper-botao" data-campo="${campo}" data-delta="1" aria-label="Aumentar ${esc(rotulo)}">+</button>
    </div>`;
}

/** Linha de chips com seleção única. `opcoes` = [{valor, rotulo}]. */
export function chips(nome, opcoes, selecionado) {
  return `
    <div class="chips" role="group" data-chips="${nome}">
      ${opcoes.map((o) => `
        <button type="button" class="chip-filtro" data-valor="${esc(o.valor)}"
          aria-pressed="${String(o.valor === selecionado)}">${esc(o.rotulo)}</button>`).join('')}
    </div>`;
}
