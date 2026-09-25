// Criar exercício personalizado ou editar um da biblioteca.

import { get } from '../db/db.js';
import {
  salvarExercicio, excluirExercicio, temHistorico, adicionarAoTreino,
} from '../db/edicao.js';
import { GRUPOS, EQUIPAMENTOS } from '../db/seed.js';
import { formatarCronometro } from '../lib/timer.js';
import { esc, $, toast } from '../ui/dom.js';
import { cabecalhoVoltar, stepper } from '../ui/controles.js';
import { abrirSheet } from '../ui/sheet.js';
import { ir } from '../router.js';
import { montarMidia, imagemIdDe } from '../lib/midia.js';

const opcoes = (lista, atual) => {
  const todas = lista.includes(atual) ? lista : [atual, ...lista];
  return todas.map((v) => `<option value="${esc(v)}"${v === atual ? ' selected' : ''}>${esc(v)}</option>`).join('');
};

export async function render(view, id, query) {
  const novo = id === 'novo';
  const salvo = novo ? null : await get('exercicios', id);
  if (!novo && !salvo) {
    location.replace('#/ajustes/exercicios');
    return;
  }
  const ex = salvo ?? {
    nome: '', apelidos: [], grupo_muscular: GRUPOS[0], equipamento: EQUIPAMENTOS[0],
    tipo_registro: 'peso_reps', duracao_alvo: 60,
  };
  const tipoTravado = !novo && await temHistorico(id);
  const destino = query.treino ? `ajustes/treino/${query.treino}/adicionar` : 'ajustes/exercicios';
  let tipo = ex.tipo_registro;
  let alvo = ex.duracao_alvo ?? 60;

  view.classList.add('com-acao');
  view.innerHTML = `
    ${cabecalhoVoltar(novo ? 'Novo exercício' : 'Editar exercício', destino)}
    <form class="formulario" id="form-exercicio" novalidate>
      <label class="campo-rotulo">Nome
        <input class="entrada" name="nome" maxlength="60" required value="${esc(ex.nome)}" placeholder="Ex.: Remada no TRX">
      </label>
      <label class="campo-rotulo">Apelidos
        <input class="entrada" name="apelidos" value="${esc((ex.apelidos ?? []).join(', '))}" placeholder="Separados por vírgula">
      </label>
      <div class="form-linha">
        <label class="campo-rotulo campo-cresce">Grupo muscular
          <select class="entrada" name="grupo">${opcoes(GRUPOS, ex.grupo_muscular)}</select>
        </label>
        <label class="campo-rotulo campo-cresce">Equipamento
          <select class="entrada" name="equipamento">${opcoes(EQUIPAMENTOS, ex.equipamento)}</select>
        </label>
      </div>

      <div class="campo-rotulo">Tipo de registro
        <div class="segmentado" role="group">
          <button type="button" data-tipo="peso_reps" aria-pressed="${tipo === 'peso_reps'}" ${tipoTravado ? 'disabled' : ''}>Peso e reps</button>
          <button type="button" data-tipo="tempo" aria-pressed="${tipo === 'tempo'}" ${tipoTravado ? 'disabled' : ''}>Tempo</button>
        </div>
        ${tipoTravado ? '<span class="texto-apoio fraco">Já tem séries registradas, o tipo não pode mudar.</span>' : ''}
      </div>

      <div class="campo-rotulo" id="bloco-alvo"${tipo === 'tempo' ? '' : ' hidden'}>Duração alvo
        ${stepper('alvo', formatarCronometro(alvo * 1000), 'duração alvo')}
      </div>

      <div class="campo-rotulo">Imagem de execução
        ${novo
          ? '<span class="texto-apoio fraco">Depois de salvar, dá pra escolher uma imagem no catálogo.</span>'
          : `<div class="imagem-exercicio">
              <div class="midia midia-mini" id="imagem-atual"></div>
              <div class="imagem-acoes">
                <a class="botao botao-compacto" href="#/ajustes/catalogo?imagem=${esc(ex.id)}">Escolher no catálogo</a>
                ${imagemIdDe(ex) ? '<button type="button" class="botao-texto" id="sem-imagem">Ficar sem imagem</button>' : ''}
              </div>
            </div>`}
      </div>

      ${novo ? '' : ex.personalizado
        ? '<button type="button" class="botao botao-perigo" id="excluir">Excluir exercício</button>'
        : `<button type="button" class="botao" id="ocultar">${ex.ativo === false ? 'Mostrar na busca' : 'Ocultar da busca'}</button>`}
    </form>

    <div class="acao-fixa">
      <button type="submit" form="form-exercicio" class="botao botao-primario">${novo && query.treino ? 'Criar e adicionar' : 'Salvar'}</button>
    </div>`;

  const form = $('#form-exercicio', view);

  view.querySelectorAll('[data-tipo]').forEach((botao) => {
    botao.onclick = () => {
      tipo = botao.dataset.tipo;
      view.querySelectorAll('[data-tipo]').forEach((b) => b.setAttribute('aria-pressed', String(b === botao)));
      $('#bloco-alvo', view).hidden = tipo !== 'tempo';
    };
  });

  $('#bloco-alvo', view).addEventListener('click', (e) => {
    const b = e.target.closest('[data-delta]');
    if (!b) return;
    const delta = Number(b.dataset.delta);
    const passo = (delta < 0 ? alvo - 1 : alvo) < 60 ? 5 : 15;
    alvo = Math.min(3600, Math.max(5, alvo + delta * passo));
    $('#bloco-alvo .stepper-valor', view).textContent = formatarCronometro(alvo * 1000);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = new FormData(form);
    const nome = dados.get('nome').trim();
    if (!nome) {
      form.nome.classList.add('erro');
      form.nome.focus();
      return;
    }
    const atualizado = {
      ...ex,
      nome,
      apelidos: dados.get('apelidos').split(',').map((a) => a.trim()).filter(Boolean),
      grupo_muscular: dados.get('grupo'),
      equipamento: dados.get('equipamento'),
      tipo_registro: tipo,
      duracao_alvo: alvo,
    };
    const gravado = await salvarExercicio(atualizado);

    if (novo && query.treino) {
      await adicionarAoTreino(query.treino, gravado);
      ir(`ajustes/treino/${query.treino}`);
      toast(`${gravado.nome} criado e adicionado`);
      return;
    }
    ir(destino);
    toast(novo ? `${gravado.nome} criado` : 'Exercício salvo');
  });

  form.nome.addEventListener('input', () => form.nome.classList.remove('erro'));

  const imagemAtual = $('#imagem-atual', view);
  if (imagemAtual) montarMidia(imagemAtual, ex);
  const semImagem = $('#sem-imagem', view);
  if (semImagem) {
    semImagem.onclick = async () => {
      Object.assign(ex, await salvarExercicio({ ...ex, imagem_id: '' }));
      montarMidia(imagemAtual, ex);
      semImagem.remove();
      toast('Exercício ficou sem imagem');
    };
  }

  const ocultar = $('#ocultar', view);
  if (ocultar) {
    ocultar.onclick = async () => {
      const ativo = ex.ativo === false;
      await salvarExercicio({ ...ex, ativo });
      ir(destino);
      toast(ativo ? `${ex.nome} voltou para a busca` : `${ex.nome} oculto da busca`);
    };
  }

  const excluir = $('#excluir', view);
  if (excluir) {
    excluir.onclick = async () => {
      const ok = await abrirSheet({
        titulo: 'Excluir exercício?',
        texto: 'Ele sai de todos os treinos. Se já tiver séries registradas, fica guardado só para o histórico.',
        acoes: [{ id: 'sim', rotulo: 'Excluir exercício', perigo: true }],
      });
      if (!ok) return;
      const resultado = await excluirExercicio(ex.id);
      ir(destino);
      toast(resultado === 'arquivado' ? `${ex.nome} excluído (histórico mantido)` : `${ex.nome} excluído`);
    };
  }
}
