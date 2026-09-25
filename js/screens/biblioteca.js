// Biblioteca completa: ver, editar, ocultar e criar exercícios.

import { listarExercicios } from '../db/edicao.js';
import { $ } from '../ui/dom.js';
import { icone } from '../ui/icones.js';
import { cabecalhoVoltar } from '../ui/controles.js';
import { montarBusca } from '../ui/busca-exercicios.js';
import { ir } from '../router.js';

export async function render(view) {
  const exercicios = await listarExercicios();

  view.innerHTML = `
    ${cabecalhoVoltar('Exercícios', 'ajustes')}
    <div class="botoes-lado">
      <a class="botao" href="#/ajustes/catalogo">${icone('busca')}Catálogo online</a>
      <a class="botao" href="#/ajustes/exercicio/novo">${icone('mais')}Criar</a>
    </div>
    <div id="busca" class="bloco-busca"></div>`;

  montarBusca($('#busca', view), {
    exercicios,
    decorar: (ex) => {
      if (ex.ativo === false) return { nota: 'Oculto', apagado: true };
      if (ex.personalizado) return { nota: 'Seu' };
      return {};
    },
    aoEscolher: (ex) => ir(`ajustes/exercicio/${ex.id}`),
  });
}
