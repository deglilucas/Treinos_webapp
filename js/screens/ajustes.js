// Tela Ajustes — montagem dos treinos A/B/C e biblioteca de exercícios. Próxima etapa.

import { getAll } from '../db/db.js';

export async function render(view) {
  const exercicios = await getAll('exercicios');
  view.innerHTML = `
    <h1 class="titulo">Ajustes</h1>
    <p class="subtitulo">Em construção · ${exercicios.length} exercícios na biblioteca.</p>`;
}
