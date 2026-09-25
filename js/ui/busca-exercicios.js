// Busca na biblioteca: texto (nome/apelido, sem acento) + filtro por grupo e equipamento.

import { combina } from '../db/edicao.js';
import { GRUPOS, EQUIPAMENTOS } from '../db/seed.js';
import { esc } from './dom.js';
import { icone } from './icones.js';
import { chips } from './controles.js';

const comTodos = (lista) => [{ valor: '', rotulo: 'Todos' }, ...lista.map((v) => ({ valor: v, rotulo: v }))];

/**
 * @param {HTMLElement} el
 * @param {{
 *   exercicios: object[],
 *   decorar?: (ex) => {nota?: string, desabilitado?: boolean, apagado?: boolean},
 *   aoEscolher: (ex, botao: HTMLElement) => void,
 * }} opcoes
 * @returns {{ atualizar(): void }} redesenha a lista (ex.: depois de adicionar um item)
 */
export function montarBusca(el, { exercicios, decorar = () => ({}), aoEscolher }) {
  const estado = { termo: '', grupo: '', equipamento: '' };

  el.innerHTML = `
    <label class="busca">
      ${icone('busca')}
      <input type="search" class="entrada busca-entrada" placeholder="Buscar por nome ou apelido"
        autocomplete="off" enterkeyhint="search" aria-label="Buscar exercício">
    </label>
    ${chips('grupo', comTodos(GRUPOS), '')}
    ${chips('equipamento', comTodos(EQUIPAMENTOS), '')}
    <div class="busca-contagem"></div>
    <div class="lista lista-exercicios"></div>`;

  const lista = el.querySelector('.lista-exercicios');
  const contagem = el.querySelector('.busca-contagem');

  function desenhar() {
    const achados = exercicios.filter((ex) =>
      (!estado.grupo || ex.grupo_muscular === estado.grupo)
      && (!estado.equipamento || ex.equipamento === estado.equipamento)
      && combina(ex, estado.termo));

    contagem.textContent = achados.length === 1 ? '1 exercício' : `${achados.length} exercícios`;
    lista.innerHTML = achados.length ? achados.map((ex) => {
      const d = decorar(ex);
      const tipo = ex.tipo_registro === 'tempo' ? ' · tempo' : '';
      return `
        <button type="button" class="item-exercicio${d.apagado ? ' apagado' : ''}" data-id="${esc(ex.id)}"
          ${d.desabilitado ? 'disabled' : ''}>
          <span class="item-texto">
            <span class="item-titulo">${esc(ex.nome)}</span>
            <span class="item-sub">${esc(ex.grupo_muscular)} · ${esc(ex.equipamento)}${tipo}</span>
          </span>
          ${d.nota ? `<span class="item-nota">${esc(d.nota)}</span>` : icone('avancar')}
        </button>`;
    }).join('') : '<div class="vazio">Nenhum exercício encontrado.</div>';
  }

  el.querySelector('.busca-entrada').addEventListener('input', (e) => {
    estado.termo = e.target.value;
    desenhar();
  });

  el.querySelectorAll('[data-chips]').forEach((grupo) => {
    grupo.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip-filtro');
      if (!chip) return;
      estado[grupo.dataset.chips] = chip.dataset.valor;
      grupo.querySelectorAll('.chip-filtro').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
      desenhar();
    });
  });

  lista.addEventListener('click', (e) => {
    const botao = e.target.closest('.item-exercicio');
    if (!botao || botao.disabled) return;
    aoEscolher(exercicios.find((x) => x.id === botao.dataset.id), botao);
  });

  desenhar();
  return { atualizar: desenhar };
}
