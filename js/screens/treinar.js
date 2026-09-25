// Aba Treinar: escolhe o treino e inicia. Com um treino em andamento, vai
// direto para a execução (#/treinar/sessao/:id).

import {
  listarTreinos, sessaoAtiva, sugerirTreino, iniciarSessao, exerciciosDoTreino,
  ultimaSessaoDoTreino, nomeCompletoTreino,
} from '../db/repo.js';
import { rotuloDia } from '../lib/datas.js';
import { esc, $ } from '../ui/dom.js';
import { ir } from '../router.js';
import * as sessao from './sessao.js';

export async function render(view, { params, query }) {
  if (params[0] === 'sessao' && params[1]) return sessao.render(view, params[1]);

  const ativa = await sessaoAtiva();
  if (ativa) {
    location.replace(`#/treinar/sessao/${ativa.id}`);
    return;
  }

  const [treinos, sugestao] = await Promise.all([listarTreinos(), sugerirTreino()]);
  const detalhes = await Promise.all(treinos.map(async (t) => ({
    treino: t,
    itens: await exerciciosDoTreino(t.id),
    ultima: await ultimaSessaoDoTreino(t.id),
  })));

  let selecionado = treinos.find((t) => t.id === query.treino)?.id ?? sugestao?.treino?.id;

  view.classList.add('com-acao');
  view.innerHTML = `
    <h1 class="titulo">Treinar</h1>
    <p class="subtitulo">Escolha o treino de hoje</p>
    <div class="lista escolha-treino">
      ${detalhes.length ? detalhes.map(({ treino, itens, ultima }) => `
        <button type="button" class="item-historico opcao-treino" data-treino="${treino.id}">
          <div class="selo">${esc(treino.sigla)}</div>
          <div class="item-texto">
            <div class="item-titulo">${esc(nomeCompletoTreino(treino))}</div>
            <div class="item-sub">${itens.length} exercícios · ${ultima ? `última vez: ${esc(rotuloDia(ultima.data).toLowerCase())}` : 'ainda não feito'}</div>
            <div class="opcao-exercicios">${esc(itens.map((i) => i.exercicio.nome).join(' · ') || 'Nenhum exercício')}</div>
          </div>
        </button>`).join('') : '<div class="vazio">Nenhum treino montado ainda.</div>'}
    </div>
    <div class="acao-fixa">
      <button type="button" class="botao botao-primario" id="iniciar"></button>
    </div>`;

  const botao = $('#iniciar', view);

  function atualizar() {
    view.querySelectorAll('.opcao-treino').forEach((el) =>
      el.setAttribute('aria-pressed', String(el.dataset.treino === selecionado)));
    const det = detalhes.find((d) => d.treino.id === selecionado);
    botao.disabled = !det?.itens.length;
    botao.textContent = !det ? 'Montar meus treinos'
      : det.itens.length ? `Iniciar Treino ${det.treino.sigla}` : 'Treino sem exercícios';
  }

  view.querySelectorAll('.opcao-treino').forEach((el) => {
    el.onclick = () => { selecionado = el.dataset.treino; atualizar(); };
  });

  botao.onclick = async () => {
    if (!selecionado) return ir('ajustes');
    const nova = await iniciarSessao(selecionado);
    ir(`treinar/sessao/${nova.id}`);
  };

  atualizar();
}
