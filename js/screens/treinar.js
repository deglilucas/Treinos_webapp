// Tela Treinar — execução do treino. Próxima etapa.

import { listarTreinos, nomeCompletoTreino } from '../db/repo.js';
import { esc } from '../ui/dom.js';

export async function render(view, { query }) {
  const treinos = await listarTreinos();
  view.innerHTML = `
    <h1 class="titulo">Treinar</h1>
    <p class="subtitulo">Tela de execução em construção.</p>
    <h2 class="rotulo-secao">Seus treinos</h2>
    <div class="lista">
      ${treinos.map((t) => `
        <div class="item-historico">
          <div class="selo">${esc(t.sigla)}</div>
          <div class="item-texto">
            <div class="item-titulo">${esc(nomeCompletoTreino(t))}</div>
            <div class="item-sub">${t.id === query.treino ? 'Sugerido para hoje' : '&nbsp;'}</div>
          </div>
        </div>`).join('')}
    </div>`;
}
