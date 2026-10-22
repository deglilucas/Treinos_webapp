// Seletor de peso e repetições em rodas, no lugar do teclado.
// Centenas ficam numa roda à parte, para o caso comum (abaixo de 100) ser
// uma rolagem só; no peso, os decimais também têm a sua.

import { esc } from './dom.js';

const ALTURA = 44; // precisa bater com --roda-item no CSS
const pad2 = (n) => String(n).padStart(2, '0');
const faixa = (de, ate, passo = 1) => Array.from({ length: Math.floor((ate - de) / passo) + 1 }, (_, i) => de + i * passo);

function htmlRoda(nome, rotulo, opcoes, indice) {
  return `
    <div class="roda" data-roda="${nome}">
      <span class="roda-rotulo">${esc(rotulo)}</span>
      <div class="roda-janela">
        <div class="roda-faixa"></div>
        <div class="roda-lista" data-indice="${indice}" role="listbox" aria-label="${esc(rotulo)}">
          ${opcoes.map((texto, i) => `<div class="roda-item" role="option" data-i="${i}">${esc(texto)}</div>`).join('')}
        </div>
      </div>
    </div>`;
}

const htmlSeparador = () => `
  <div class="roda roda-sep" aria-hidden="true">
    <span class="roda-rotulo">&nbsp;</span>
    <div class="roda-janela"><span>,</span></div>
  </div>`;

/**
 * @param {{titulo: string, valor: number, decimais?: boolean}} opcoes
 * @returns {Promise<number|null>} valor escolhido, ou null se fechou
 */
export function pedirNumero({ titulo, valor, decimais = false }) {
  // Tudo em centésimos, para não acumular erro de ponto flutuante.
  const total = Math.round(Math.max(0, valor) * 100);
  const dec = total % 100;
  const inteiro = Math.floor(total / 100);
  const centena = Math.min(9, Math.floor(inteiro / 100));
  const resto = inteiro % 100;

  // Decimais de 5 em 5 (0,5 · 2,5 · 1,25 …); se o valor atual fugir disso, ele entra na lista.
  const opcoesDec = faixa(0, 95, 5);
  if (!opcoesDec.includes(dec)) opcoesDec.push(dec);
  opcoesDec.sort((a, b) => a - b);

  return new Promise((resolve) => {
    const fundo = document.createElement('div');
    fundo.className = 'sheet-fundo';
    fundo.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
        <h2 class="sheet-titulo">${esc(titulo)}</h2>
        <div class="rodas">
          ${htmlRoda('centena', 'Centenas', faixa(0, 9).map(String), centena)}
          ${htmlRoda('resto', 'Dezenas e unidades', faixa(0, 99).map(pad2), resto)}
          ${decimais ? htmlSeparador() + htmlRoda('decimal', 'Decimais', opcoesDec.map(pad2), opcoesDec.indexOf(dec)) : ''}
        </div>
        <div class="sheet-acoes">
          <button type="button" class="botao botao-primario" data-confirmar>Confirmar</button>
          <button type="button" class="botao botao-fantasma" data-fechar>Voltar</button>
        </div>
      </div>`;

    const lerRoda = (nome) => {
      const lista = fundo.querySelector(`[data-roda="${nome}"] .roda-lista`);
      const ultimo = lista.childElementCount - 1;
      return Math.min(ultimo, Math.max(0, Math.round(lista.scrollTop / ALTURA)));
    };

    const fechar = (resultado) => {
      fundo.remove();
      window.removeEventListener('hashchange', aoNavegar);
      resolve(resultado);
    };
    const aoNavegar = () => fechar(null);

    fundo.addEventListener('click', (e) => {
      if (e.target === fundo || e.target.closest('[data-fechar]')) return fechar(null);
      if (e.target.closest('[data-confirmar]')) {
        const inteiroEscolhido = lerRoda('centena') * 100 + lerRoda('resto');
        const centesimos = decimais ? opcoesDec[lerRoda('decimal')] : 0;
        return fechar((inteiroEscolhido * 100 + centesimos) / 100);
      }
      // Toque num número leva a roda até ele.
      const item = e.target.closest('.roda-item');
      if (item) item.parentElement.scrollTo({ top: Number(item.dataset.i) * ALTURA, behavior: 'smooth' });
    });
    window.addEventListener('hashchange', aoNavegar);
    document.body.append(fundo);

    // Só depois de estar na tela dá para posicionar a rolagem.
    fundo.querySelectorAll('.roda-lista').forEach((lista) => {
      lista.scrollTop = Number(lista.dataset.indice) * ALTURA;
    });
  });
}

/**
 * Faz os campos de peso e reps dentro de `raiz` abrirem o seletor ao toque.
 * O valor escolhido entra no campo e dispara input/change, como se tivesse
 * sido digitado, então o resto da tela não precisa saber do seletor.
 */
export function ligarSeletores(raiz) {
  raiz.addEventListener('click', async (e) => {
    const campo = e.target.closest('.campo[name=peso], .campo[name=reps]');
    if (!campo) return;
    const peso = campo.name === 'peso';
    const atual = parseFloat(campo.value.replace(',', '.'));
    const escolhido = await pedirNumero({
      titulo: peso ? 'Peso em kg' : 'Repetições',
      valor: Number.isFinite(atual) ? atual : (peso ? 0 : 10),
      decimais: peso,
    });
    if (escolhido == null) return;
    campo.value = String(escolhido).replace('.', ',');
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    campo.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
