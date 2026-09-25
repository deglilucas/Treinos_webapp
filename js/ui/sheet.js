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
