import { abrirDB } from './db/db.js';
import { garantirSeed } from './db/seed.js';
import { iniciarRouter } from './router.js';
import { icone } from './ui/icones.js';
import { $, esc, toast } from './ui/dom.js';

import * as inicio from './screens/inicio.js';
import * as treinar from './screens/treinar.js';
import * as progresso from './screens/progresso.js';
import * as ajustes from './screens/ajustes.js';

const ABAS = [
  { rota: 'inicio', rotulo: 'Início' },
  { rota: 'treinar', rotulo: 'Treinar' },
  { rota: 'progresso', rotulo: 'Progresso' },
  { rota: 'ajustes', rotulo: 'Ajustes' },
];

function montarTabbar() {
  $('#tabbar').innerHTML = ABAS.map((a) =>
    `<a class="tab" href="#/${a.rota}" data-rota="${a.rota}">${icone(a.rota)}<span>${a.rotulo}</span></a>`,
  ).join('');
}

function marcarAbaAtiva(rota) {
  document.querySelectorAll('.tab').forEach((tab) => {
    if (tab.dataset.rota === rota) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });
}

function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const jaControlado = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('SW:', err));
  // Uma versão nova assumiu: oferece recarregar (os dados ficam no IndexedDB).
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (jaControlado) toast('Nova versão disponível', { rotulo: 'Atualizar', fn: () => location.reload() }, 0);
  });
}

async function iniciar() {
  montarTabbar();
  await abrirDB();
  await garantirSeed();
  // Pede ao navegador para não apagar o IndexedDB quando faltar espaço.
  navigator.storage?.persist?.().catch(() => {});

  iniciarRouter($('#view'), { inicio, treinar, progresso, ajustes }, marcarAbaAtiva);
  registrarServiceWorker();
}

iniciar().catch((err) => {
  console.error(err);
  $('#view').innerHTML = `<div class="vazio">Não foi possível abrir o banco local.<br>${esc(err.message)}</div>`;
});
