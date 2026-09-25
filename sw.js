// Service worker: app shell offline + cache de fontes + cache de GIFs.
//
// A cada deploy que mude arquivos do app, suba VERSAO. O cache de mídia não
// depende da versão, então os GIFs já vistos continuam disponíveis offline.

const VERSAO = 'v3';
const CACHE_APP = `treinos-app-${VERSAO}`;
const CACHE_FONTES = 'treinos-fontes';
const CACHE_MIDIA = 'treinos-midia';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/tokens.css',
  './css/app.css',
  './js/app.js',
  './js/router.js',
  './js/db/db.js',
  './js/db/schema.js',
  './js/db/seed.js',
  './js/db/repo.js',
  './js/lib/datas.js',
  './js/lib/timer.js',
  './js/lib/midia.js',
  './js/lib/alerta.js',
  './js/ui/dom.js',
  './js/ui/icones.js',
  './js/ui/sheet.js',
  './js/screens/inicio.js',
  './js/screens/treinar.js',
  './js/screens/sessao.js',
  './js/screens/progresso.js',
  './js/screens/ajustes.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

const HOSTS_FONTES = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const HOSTS_MIDIA = ['static.exercisedb.dev', 'v2.exercisedb.io', 'exercisedb-api.vercel.app'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_APP)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(
        chaves
          .filter((c) => c.startsWith('treinos-app-') && c !== CACHE_APP)
          .map((c) => caches.delete(c)),
      ))
      .then(() => self.clients.claim()),
  );
});

// Arquivos do app: cache primeiro. Navegações caem sempre no index.html.
async function doApp(request) {
  const cache = await caches.open(CACHE_APP);
  if (request.mode === 'navigate') {
    return (await cache.match('./index.html')) ?? fetch(request);
  }
  const salvo = await cache.match(request, { ignoreSearch: true });
  if (salvo) return salvo;
  const resp = await fetch(request);
  if (resp.ok) cache.put(request, resp.clone());
  return resp;
}

// Fontes: devolve o que tem e atualiza em segundo plano.
async function dasFontes(request) {
  const cache = await caches.open(CACHE_FONTES);
  const salvo = await cache.match(request);
  const rede = fetch(request)
    .then((resp) => { if (resp.ok || resp.type === 'opaque') cache.put(request, resp.clone()); return resp; })
    .catch(() => null);
  return salvo ?? (await rede) ?? Response.error();
}

// GIFs: depois de baixado uma vez, fica para sempre no cache.
async function daMidia(request) {
  const cache = await caches.open(CACHE_MIDIA);
  const salvo = await cache.match(request);
  if (salvo) return salvo;
  try {
    const resp = await fetch(request);
    // <img> cross-origin chega como resposta opaca; dá pra guardar do mesmo jeito.
    if (resp.ok || resp.type === 'opaque') cache.put(request, resp.clone());
    return resp;
  } catch {
    return Response.error(); // a tela troca pelo fallback no onerror da imagem
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    event.respondWith(doApp(request));
  } else if (HOSTS_FONTES.includes(url.hostname)) {
    event.respondWith(dasFontes(request));
  } else if (request.destination === 'image' && (HOSTS_MIDIA.includes(url.hostname) || url.pathname.endsWith('.gif'))) {
    event.respondWith(daMidia(request));
  }
  // Chamadas à API (JSON) seguem direto pra rede; a URL do GIF já fica salva no IndexedDB.
});
