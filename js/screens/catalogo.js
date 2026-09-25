// Catálogo online: 876 exercícios do free-exercise-db (domínio público), com
// fotos. Três usos:
//   #/ajustes/catalogo?treino=ID   importar e já colocar no treino
//   #/ajustes/catalogo?imagem=ID   escolher a imagem de um exercício existente
//   #/ajustes/catalogo             importar para a biblioteca
// Os nomes vêm em inglês; a busca entende termos em português e dá pra
// renomear na hora de importar.

import { get, getAll } from '../db/db.js';
import { salvarExercicio, adicionarAoTreino } from '../db/edicao.js';
import { combinaCatalogo } from '../lib/traducao.js';
import { montarMidia, urlsDaImagem } from '../lib/midia.js';
import { esc, $, toast } from '../ui/dom.js';
import { cabecalhoVoltar } from '../ui/controles.js';
import { montarBusca } from '../ui/busca-exercicios.js';
import { ir } from '../router.js';

let catalogo = null; // carregado uma vez; o service worker guarda o arquivo para usar offline

async function carregarCatalogo() {
  if (catalogo) return catalogo;
  const resp = await fetch('./data/catalogo.json');
  if (!resp.ok) throw new Error('catálogo indisponível');
  catalogo = (await resp.json()).map(([id, nome, grupo, equipamento, tipo, imagens]) => ({
    id, nome, apelidos: [], grupo_muscular: grupo, equipamento, tipo_registro: tipo, imagens,
  }));
  return catalogo;
}

/** Painel de detalhe com as fotos animadas e a ação. Resolve { nome } ou null. */
function abrirDetalhe(item, { rotuloAcao, pedirNome }) {
  return new Promise((resolve) => {
    const fundo = document.createElement('div');
    fundo.className = 'sheet-fundo';
    fundo.innerHTML = `
      <div class="sheet sheet-catalogo" role="dialog" aria-modal="true" aria-label="${esc(item.nome)}">
        <div class="midia midia-grande" id="midia-catalogo"></div>
        <h2 class="sheet-titulo">${esc(item.nome)}</h2>
        <p class="sheet-texto">${esc(item.grupo_muscular)} · ${esc(item.equipamento)}${item.tipo_registro === 'tempo' ? ' · tempo' : ''}</p>
        ${pedirNome ? `
          <label class="campo-rotulo campo-nome-catalogo">Nome no app
            <input class="entrada" name="nome" maxlength="60" value="${esc(item.nome)}">
          </label>` : ''}
        <div class="sheet-acoes">
          <button type="button" class="botao botao-primario" data-id="ok">${esc(rotuloAcao)}</button>
          <button type="button" class="botao botao-fantasma" data-id="">Voltar</button>
        </div>
      </div>`;

    const fechar = (resultado) => {
      fundo.remove();
      window.removeEventListener('hashchange', aoNavegar);
      resolve(resultado);
    };
    const aoNavegar = () => fechar(null);
    fundo.addEventListener('click', (e) => {
      if (e.target === fundo) return fechar(null);
      const botao = e.target.closest('[data-id]');
      if (!botao) return;
      if (!botao.dataset.id) return fechar(null);
      const nome = fundo.querySelector('[name=nome]')?.value.trim() || item.nome;
      fechar({ nome });
    });
    window.addEventListener('hashchange', aoNavegar);
    document.body.append(fundo);
    montarMidia(fundo.querySelector('#midia-catalogo'), item, { animar: true, imagemId: item.id });
  });
}

export async function render(view, query) {
  const modoImagem = query.imagem ? await get('exercicios', query.imagem) : null;
  const treino = query.treino ? await get('treinos', query.treino) : null;
  const voltar = modoImagem ? `ajustes/exercicio/${modoImagem.id}`
    : treino ? `ajustes/treino/${treino.id}/adicionar` : 'ajustes/exercicios';
  const titulo = modoImagem ? 'Escolher imagem' : 'Catálogo online';

  view.innerHTML = `
    ${cabecalhoVoltar(titulo, voltar)}
    <p class="texto-apoio">${modoImagem
      ? `Imagem para <strong>${esc(modoImagem.nome)}</strong>.`
      : '876 exercícios com fotos, da base aberta free-exercise-db. Os nomes estão em inglês, mas dá pra buscar em português e renomear ao importar.'}</p>
    <div id="busca-catalogo" class="bloco-busca"><div class="vazio">Carregando o catálogo…</div></div>`;

  let itens;
  try {
    itens = await carregarCatalogo();
  } catch {
    $('#busca-catalogo', view).innerHTML = '<div class="vazio">Não deu pra carregar o catálogo. Ele precisa de internet na primeira vez.</div>';
    return;
  }

  // Já importados (para não duplicar e para marcar na lista).
  const importados = new Map((await getAll('exercicios')).filter((e) => e.catalogo_id).map((e) => [e.catalogo_id, e]));

  montarBusca($('#busca-catalogo', view), {
    exercicios: itens,
    combinar: combinaCatalogo,
    placeholder: 'Buscar (ex.: supino inclinado, remada, stretch)',
    limite: 60,
    miniatura: (item) => urlsDaImagem(item.id)[0],
    decorar: (item) => (importados.has(item.id) && !modoImagem ? { nota: 'Já no app' } : {}),
    aoEscolher: async (item) => {
      if (modoImagem) {
        const ok = await abrirDetalhe(item, { rotuloAcao: 'Usar esta imagem', pedirNome: false });
        if (!ok) return;
        await salvarExercicio({ ...modoImagem, imagem_id: item.id });
        ir(voltar);
        toast('Imagem atualizada');
        return;
      }

      const existente = importados.get(item.id);
      const ok = await abrirDetalhe(item, {
        rotuloAcao: treino ? `Adicionar ao Treino ${treino.sigla}` : existente ? 'Já está na biblioteca' : 'Adicionar à biblioteca',
        pedirNome: !existente,
      });
      if (!ok) return;

      const exercicio = existente ?? await salvarExercicio({
        nome: ok.nome,
        apelidos: ok.nome !== item.nome ? [item.nome] : [],
        grupo_muscular: item.grupo_muscular,
        equipamento: item.equipamento,
        tipo_registro: item.tipo_registro,
        duracao_alvo: item.tipo_registro === 'tempo' ? (item.grupo_muscular === 'Cardio' ? 600 : 30) : undefined,
        imagem_id: item.id,
        catalogo_id: item.id,
      });
      importados.set(item.id, exercicio);

      if (treino) {
        const adicionado = await adicionarAoTreino(treino.id, exercicio);
        ir(`ajustes/treino/${treino.id}`);
        toast(adicionado ? `${exercicio.nome} adicionado ao treino` : `${exercicio.nome} já estava no treino`);
      } else {
        toast(existente ? `${exercicio.nome} já está na biblioteca` : `${exercicio.nome} adicionado à biblioteca`);
        ir(`ajustes/exercicio/${exercicio.id}`);
      }
    },
  });
}

