// Montar um treino: nome, letra, exercícios com séries, descanso e alvo.
// Tudo é salvo na hora, sem botão de salvar.

import { exerciciosDoTreino, sessaoAtiva } from '../db/repo.js';
import { get } from '../db/db.js';
import {
  atualizarTreino, excluirTreino, atualizarItemTreino, removerDoTreino, moverNoTreino,
} from '../db/edicao.js';
import { formatarSegundos, formatarCronometro } from '../lib/timer.js';
import { esc, $, toast } from '../ui/dom.js';
import { icone } from '../ui/icones.js';
import { cabecalhoVoltar, stepper } from '../ui/controles.js';
import { abrirSheet } from '../ui/sheet.js';
import { ir } from '../router.js';

const alvoDe = (item) => item.duracao_alvo ?? item.exercicio.duracao_alvo ?? 60;

// Regras de cada controle: passo, limites e como mostrar o valor.
const CONTROLES = {
  series: {
    valor: (i) => i.series,
    passo: () => 1, min: 1, max: 10,
    texto: (v) => String(v),
  },
  descanso_padrao: {
    valor: (i) => i.descanso_padrao,
    passo: () => 15, min: 0, max: 600,
    texto: (v) => (v ? formatarSegundos(v) : 'sem'),
  },
  duracao_alvo: {
    valor: alvoDe,
    // De 5 em 5s até 1 minuto, depois de 15 em 15s.
    passo: (v, delta) => ((delta < 0 ? v - 1 : v) < 60 ? 5 : 15),
    min: 5, max: 3600,
    texto: (v) => formatarCronometro(v * 1000),
  },
};

function htmlItem(item, indice, total) {
  const ex = item.exercicio;
  const linha = (campo, rotulo) => `
    <span class="config-rotulo">${rotulo}</span>
    ${stepper(campo, CONTROLES[campo].texto(CONTROLES[campo].valor(item)), rotulo.toLowerCase())}`;
  return `
    <article class="card item-editor" data-item="${esc(item.id)}">
      <div class="item-editor-topo">
        <div class="ordem-botoes">
          <button type="button" class="botao-icone" data-mover="-1" aria-label="Subir" ${indice === 0 ? 'disabled' : ''}>${icone('cima')}</button>
          <button type="button" class="botao-icone" data-mover="1" aria-label="Descer" ${indice === total - 1 ? 'disabled' : ''}>${icone('baixo')}</button>
        </div>
        <div class="item-texto">
          <div class="item-titulo">${esc(ex.nome)}</div>
          <div class="item-sub">${esc(ex.grupo_muscular)} · ${esc(ex.equipamento)}</div>
        </div>
        <button type="button" class="botao-icone botao-icone-perigo" data-remover aria-label="Tirar ${esc(ex.nome)} do treino">${icone('lixeira')}</button>
      </div>
      <div class="config-grade">
        ${linha('series', 'Séries')}
        ${linha('descanso_padrao', 'Descanso')}
        ${ex.tipo_registro === 'tempo' ? linha('duracao_alvo', 'Alvo') : ''}
      </div>
    </article>`;
}

export async function render(view, treinoId) {
  const treino = await get('treinos', treinoId);
  if (!treino) {
    location.replace('#/ajustes');
    return;
  }

  view.innerHTML = `
    ${cabecalhoVoltar('Editar treino', 'ajustes')}
    <div class="form-linha">
      <label class="campo-rotulo campo-sigla">Letra
        <input class="entrada" name="sigla" maxlength="2" autocapitalize="characters" value="${esc(treino.sigla)}">
      </label>
      <label class="campo-rotulo campo-cresce">Nome
        <input class="entrada" name="nome" maxlength="40" value="${esc(treino.nome)}">
      </label>
    </div>

    <h2 class="rotulo-secao">Exercícios</h2>
    <div class="lista" id="itens"></div>
    <div class="lista acoes-editor">
      <a class="botao" href="#/ajustes/treino/${esc(treino.id)}/adicionar">${icone('mais')}Adicionar exercício</a>
      <button type="button" class="botao botao-fantasma" id="excluir-treino">Excluir treino</button>
    </div>`;

  let itens = [];
  const container = $('#itens', view);

  async function desenhar() {
    itens = await exerciciosDoTreino(treino.id);
    container.innerHTML = itens.length
      ? itens.map((item, i) => htmlItem(item, i, itens.length)).join('')
      : '<div class="vazio">Nenhum exercício. Toque em "Adicionar exercício".</div>';
  }
  await desenhar();

  // Nome e letra salvam ao sair do campo.
  view.querySelectorAll('.form-linha .entrada').forEach((campo) => {
    campo.addEventListener('change', async () => {
      const valor = campo.name === 'sigla' ? campo.value.trim().toUpperCase() : campo.value.trim();
      if (!valor) {
        campo.value = treino[campo.name];
        return;
      }
      campo.value = valor;
      treino[campo.name] = valor;
      await atualizarTreino(treino.id, { [campo.name]: valor });
    });
  });

  container.addEventListener('click', async (e) => {
    const card = e.target.closest('.item-editor');
    if (!card) return;
    const item = itens.find((i) => i.id === card.dataset.item);

    const passo = e.target.closest('[data-campo]');
    if (passo) {
      const regra = CONTROLES[passo.dataset.campo];
      const delta = Number(passo.dataset.delta);
      const atual = regra.valor(item);
      const novo = Math.min(regra.max, Math.max(regra.min, atual + delta * regra.passo(atual, delta)));
      if (novo === atual) return;
      item[passo.dataset.campo] = novo;
      card.querySelector(`[data-stepper="${passo.dataset.campo}"] .stepper-valor`).textContent = regra.texto(novo);
      await atualizarItemTreino(item.id, { [passo.dataset.campo]: novo });
      return;
    }

    const mover = e.target.closest('[data-mover]');
    if (mover) {
      await moverNoTreino(item.id, Number(mover.dataset.mover));
      await desenhar();
      return;
    }

    if (e.target.closest('[data-remover]')) {
      await removerDoTreino(item.id);
      await desenhar();
      toast(`${item.exercicio.nome} saiu do treino`);
    }
  });

  $('#excluir-treino', view).onclick = async () => {
    const ativa = await sessaoAtiva();
    if (ativa?.treino_id === treino.id) {
      toast('Esse treino está em andamento. Conclua ou cancele antes de excluir.');
      return;
    }
    const ok = await abrirSheet({
      titulo: `Excluir Treino ${treino.sigla}?`,
      texto: 'Os treinos já feitos continuam no histórico.',
      acoes: [{ id: 'sim', rotulo: 'Excluir treino' }],
    });
    if (!ok) return;
    await excluirTreino(treino.id);
    ir('ajustes');
  };
}
