// Roteamento por hash (#/inicio, #/treinar/...), que funciona no GitHub Pages
// sem configuração de servidor.

let rotas = {};
let limparTelaAtual = null;
let navegacaoAtual = 0;

function lerHash() {
  const [caminho, busca = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const [nome, ...params] = caminho.split('/').filter(Boolean);
  return { nome, params, query: Object.fromEntries(new URLSearchParams(busca)) };
}

async function renderizar(view, aoMudar) {
  const id = ++navegacaoAtual;
  const rota = lerHash();
  const nome = rotas[rota.nome] ? rota.nome : 'inicio';

  limparTelaAtual?.();
  limparTelaAtual = null;
  view.className = 'view';
  view.replaceChildren();
  aoMudar(nome);

  const limpar = await rotas[nome].render(view, rota);
  // Se o usuário trocou de aba enquanto a tela carregava, descarta.
  if (id !== navegacaoAtual) { limpar?.(); return; }
  limparTelaAtual = limpar ?? null;
  window.scrollTo(0, 0);
}

export function iniciarRouter(view, mapaDeRotas, aoMudar) {
  rotas = mapaDeRotas;
  window.addEventListener('hashchange', () => renderizar(view, aoMudar));
  renderizar(view, aoMudar);
}

export function ir(caminho) {
  location.hash = `#/${caminho}`;
}
