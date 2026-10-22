// Painel que sobe do rodapé, usado para menus e confirmações.

import { esc } from './dom.js';

/**
 * @param {{titulo?: string, texto?: string, acoes: {id: string, rotulo: string, perigo?: boolean, primario?: boolean}[], rotuloFechar?: string}} opcoes
 * @returns {Promise<string|null>} id da ação escolhida, ou null se fechou
 */
export function abrirSheet({ titulo, texto, acoes, rotuloFechar = 'Voltar' }) {
  return new Promise((resolve) => {
    const fundo = document.createElement('div');
    fundo.className = 'sheet-fundo';
    fundo.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true"${titulo ? ` aria-label="${esc(titulo)}"` : ''}>
        ${titulo ? `<h2 class="sheet-titulo">${esc(titulo)}</h2>` : ''}
        ${texto ? `<p class="sheet-texto">${esc(texto)}</p>` : ''}
        <div class="sheet-acoes">
          ${acoes.map((a) => `
            <button type="button" class="botao${a.perigo ? ' botao-perigo' : ''}${a.primario ? ' botao-primario' : ''}" data-id="${esc(a.id)}">${esc(a.rotulo)}</button>`).join('')}
          <button type="button" class="botao botao-fantasma" data-id="">${esc(rotuloFechar)}</button>
        </div>
      </div>`;

    const fechar = (id) => {
      fundo.remove();
      window.removeEventListener('hashchange', aoNavegar);
      resolve(id || null);
    };
    const aoNavegar = () => fechar(null);

    fundo.addEventListener('click', (e) => {
      if (e.target === fundo) return fechar(null);
      const botao = e.target.closest('[data-id]');
      if (botao) fechar(botao.dataset.id);
    });
    window.addEventListener('hashchange', aoNavegar);
    document.body.append(fundo);
  });
}

/**
 * Painel para digitar um tempo em minutos e segundos.
 * @param {{titulo: string, segundos: number}} opcoes
 * @returns {Promise<number|null>} total em segundos, ou null se fechou
 */
export function pedirTempo({ titulo, segundos }) {
  return new Promise((resolve) => {
    const fundo = document.createElement('div');
    fundo.className = 'sheet-fundo';
    fundo.innerHTML = `
      <form class="sheet" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
        <h2 class="sheet-titulo">${esc(titulo)}</h2>
        <div class="form-linha campo-tempo">
          <label class="campo-rotulo campo-cresce">Minutos
            <input class="entrada" name="min" type="number" inputmode="numeric" min="0" max="999" value="${Math.floor(segundos / 60)}">
          </label>
          <label class="campo-rotulo campo-cresce">Segundos
            <input class="entrada" name="seg" type="number" inputmode="numeric" min="0" max="59" value="${segundos % 60}">
          </label>
        </div>
        <div class="sheet-acoes">
          <button type="submit" class="botao botao-primario">Salvar</button>
          <button type="button" class="botao botao-fantasma" data-fechar>Voltar</button>
        </div>
      </form>`;

    const fechar = (valor) => {
      fundo.remove();
      window.removeEventListener('hashchange', aoNavegar);
      resolve(valor);
    };
    const aoNavegar = () => fechar(null);
    const form = fundo.querySelector('form');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const min = Math.max(0, parseInt(form.min.value, 10) || 0);
      const seg = Math.max(0, parseInt(form.seg.value, 10) || 0);
      fechar(min * 60 + seg);
    });
    fundo.addEventListener('click', (e) => {
      if (e.target === fundo || e.target.closest('[data-fechar]')) fechar(null);
    });
    window.addEventListener('hashchange', aoNavegar);
    document.body.append(fundo);
    form.min.focus();
    form.min.select();
  });
}
