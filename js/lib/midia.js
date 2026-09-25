// Imagens de execução, do free-exercise-db (domínio público).
//
// Cada exercício tem duas fotos (início e fim do movimento); na visão grande
// elas alternam, como um GIF. As fotos vêm do GitHub e o service worker guarda
// cada uma no cache 'treinos-midia' na primeira vez que aparece, então depois
// abrem offline. Sem imagem (ou sem cache e sem internet), aparece o ícone
// com o nome do exercício.

import { IMAGEM_BIBLIOTECA } from '../db/imagens.js';
import { esc } from '../ui/dom.js';
import { icone } from '../ui/icones.js';

const BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

/** Id da imagem no catálogo: a escolhida no exercício, senão a da biblioteca. '' = sem imagem. */
export const imagemIdDe = (exercicio) => exercicio.imagem_id ?? IMAGEM_BIBLIOTECA[exercicio.id] ?? '';

export const urlsDaImagem = (imagemId) => (imagemId ? [`${BASE}${imagemId}/0.jpg`, `${BASE}${imagemId}/1.jpg`] : []);

function fallback(nome) {
  return `<div class="midia-fallback">${icone('treinar')}<span>${esc(nome)}</span></div>`;
}

function carregar(url, alt) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.alt = alt;
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Preenche `el` (um .midia) com a imagem do exercício ou com o fallback.
 * `animar`: alterna as duas fotos (visão grande); sem ele, só a primeira (miniatura).
 */
export async function montarMidia(el, exercicio, { animar = false, imagemId = imagemIdDe(exercicio) } = {}) {
  el.innerHTML = fallback(exercicio.nome);
  const urls = urlsDaImagem(imagemId);
  if (!urls.length) return;

  try {
    const alt = `Execução: ${exercicio.nome}`;
    const primeira = await carregar(urls[0], alt);
    if (!el.isConnected) return;
    if (!animar) {
      el.replaceChildren(primeira);
      return;
    }
    // A segunda foto é opcional: se falhar, fica a primeira parada.
    const segunda = await carregar(urls[1], alt).catch(() => null);
    if (!el.isConnected) return;
    const quadro = document.createElement('div');
    quadro.className = segunda ? 'midia-animada' : 'midia-parada';
    quadro.append(primeira, ...(segunda ? [segunda] : []));
    el.replaceChildren(quadro);
  } catch {
    // sem internet e fora do cache: fica o fallback
  }
}
