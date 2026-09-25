// Utilidades pequenas de DOM. As telas montam HTML com template strings;
// todo texto vindo do banco passa por esc().

const MAPA = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => MAPA[c]);

export const $ = (sel, raiz = document) => raiz.querySelector(sel);

let timerToast;

/** Mensagem curta no rodapé. `acao` opcional: { rotulo, fn }. */
export function toast(texto, acao, duracaoMs = 2500) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(texto)}</span>${acao ? `<button type="button">${esc(acao.rotulo)}</button>` : ''}`;
  el.hidden = false;
  if (acao) el.querySelector('button').onclick = () => { el.hidden = true; acao.fn(); };
  clearTimeout(timerToast);
  if (duracaoMs) timerToast = setTimeout(() => { el.hidden = true; }, duracaoMs);
}
