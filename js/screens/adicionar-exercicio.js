// Escolher exercícios da biblioteca para um treino. Dá pra adicionar vários seguidos.

import { exerciciosDoTreino } from '../db/repo.js';
import { get } from '../db/db.js';
import { listarExercicios, adicionarAoTreino } from '../db/edicao.js';
import { esc, $, toast } from '../ui/dom.js';
import { icone } from '../ui/icones.js';
import { cabecalhoVoltar } from '../ui/controles.js';
import { montarBusca } from '../ui/busca-exercicios.js';

export async function render(view, treinoId) {
  const treino = await get('treinos', treinoId);
  if (!treino) {
    location.replace('#/ajustes');
    return;
  }
  const [itens, todos] = await Promise.all([exerciciosDoTreino(treinoId), listarExercicios()]);
  const noTreino = new Set(itens.map((i) => i.exercicio_id));

  view.innerHTML = `
    ${cabecalhoVoltar(`Adicionar ao Treino ${treino.sigla}`, `ajustes/treino/${treinoId}`)}
    <div class="botoes-lado">
      <a class="botao" href="#/ajustes/catalogo?treino=${esc(treinoId)}">${icone('busca')}Catálogo online</a>
      <a class="botao" href="#/ajustes/exercicio/novo?treino=${esc(treinoId)}">${icone('mais')}Criar</a>
    </div>
    <div id="busca" class="bloco-busca"></div>`;

  const busca = montarBusca($('#busca', view), {
    exercicios: todos.filter((ex) => ex.ativo !== false),
    decorar: (ex) => (noTreino.has(ex.id) ? { nota: 'No treino', desabilitado: true } : {}),
    aoEscolher: async (ex) => {
      if (await adicionarAoTreino(treinoId, ex)) {
        noTreino.add(ex.id);
        busca.atualizar();
        toast(`${ex.nome} adicionado`);
      }
    },
  });
}
