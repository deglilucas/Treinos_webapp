// GIFs de execução via ExerciseDB (API aberta v1).
//
// Fluxo: o exercício guarda `nome_en` (termo de busca). Na primeira vez que ele
// é exibido com internet, buscamos na API e salvamos a URL em `gif_url`. A
// imagem em si é cacheada pelo service worker (cache 'treinos-midia'), então da
// segunda vez em diante ela abre offline. Sem cache e sem internet, aparece o
// fallback com ícone + nome.

import { get, put } from '../db/db.js';
import { esc } from '../ui/dom.js';
import { icone } from '../ui/icones.js';

export const API_EXERCISEDB = 'https://exercisedb-api.vercel.app/api/v1';

// Se a busca não encontrou nada, espera uma semana antes de tentar de novo.
const ESPERA_NOVA_BUSCA_MS = 7 * 24 * 3600 * 1000;

function extrairGif(json) {
  const lista = Array.isArray(json) ? json : (json?.data ?? []);
  const item = Array.isArray(lista) ? lista[0] : lista;
  return item?.gifUrl ?? item?.gif_url ?? null;
}

async function buscarNaApi(termo) {
  const url = `${API_EXERCISEDB}/exercises/search?q=${encodeURIComponent(termo)}&limit=1`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!resp.ok) throw new Error(`ExerciseDB ${resp.status}`);
  return extrairGif(await resp.json());
}

/** Resolve a URL do GIF (do banco ou da API). Retorna null se não houver. */
export async function resolverGif(exercicioId) {
  const ex = await get('exercicios', exercicioId);
  if (!ex) return null;
  if (ex.gif_url) return ex.gif_url;

  const termo = ex.nome_en;
  const buscouRecente = ex.gif_url === '' && Date.now() - (ex.gif_busca_em ?? 0) < ESPERA_NOVA_BUSCA_MS;
  if (!termo || buscouRecente || !navigator.onLine) return null;

  try {
    const gif = await buscarNaApi(termo);
    await put('exercicios', { ...ex, gif_url: gif ?? '', gif_busca_em: Date.now() });
    return gif;
  } catch {
    return null; // rede instável: tenta de novo na próxima exibição
  }
}

function fallback(nome) {
  return `<div class="midia-fallback">${icone('treinar')}<span>${esc(nome)}</span></div>`;
}

/**
 * Preenche `el` (um .midia) com o GIF do exercício ou com o fallback.
 * Se a imagem não carregar (offline e fora do cache), troca pelo fallback.
 */
export async function montarMidia(el, exercicio) {
  el.innerHTML = fallback(exercicio.nome);
  const url = await resolverGif(exercicio.id);
  if (!url || !el.isConnected) return;

  const img = new Image();
  img.alt = `Execução: ${exercicio.nome}`;
  img.decoding = 'async';
  img.onload = () => { if (el.isConnected) el.replaceChildren(img); };
  img.src = url;
}
