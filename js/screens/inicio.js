// Tela Início: calendário do mês, histórico recente e atalho para o treino do dia.

import {
  listarTreinos, sessoesEntre, historicoRecente, sugerirTreino, nomeCompletoTreino,
} from '../db/repo.js';
import {
  chaveData, deChave, semanaDe, rotuloDia, rotuloIntervalo, diasEntre,
  MESES, INICIAIS_SEMANA, capitalizar,
} from '../lib/datas.js';
import { duracaoSessao, formatarDuracao } from '../lib/timer.js';
import { esc, $ } from '../ui/dom.js';
import { icone } from '../ui/icones.js';
import { ir } from '../router.js';

// Mês exibido sobrevive à troca de abas enquanto o app está aberto.
let mesVisivel = null; // { ano, mes }

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

function tituloMes({ ano, mes }) {
  const anoAtual = new Date().getFullYear();
  return `${capitalizar(MESES[mes])}${ano !== anoAtual ? `<small>${ano}</small>` : ''}`;
}

async function desenharCalendario(view, treinosPorId) {
  const { ano, mes } = mesVisivel;
  const hoje = chaveData();
  const primeiro = chaveData(new Date(ano, mes, 1));
  const ultimo = chaveData(new Date(ano, mes + 1, 0));
  const noMesAtual = hoje >= primeiro && hoje <= ultimo;

  const semana = semanaDe(hoje);
  const [doMes, daSemana] = await Promise.all([
    sessoesEntre(primeiro, ultimo),
    noMesAtual ? sessoesEntre(semana.inicio, semana.fim) : null,
  ]);

  const siglasPorDia = {};
  for (const s of doMes) {
    const sigla = treinosPorId[s.treino_id]?.sigla ?? '•';
    (siglasPorDia[s.data] ??= new Set()).add(sigla);
  }

  const vazios = deChave(primeiro).getDay();
  const totalDias = deChave(ultimo).getDate();
  let celulas = '<span></span>'.repeat(vazios);
  for (let dia = 1; dia <= totalDias; dia++) {
    const chave = chaveData(new Date(ano, mes, dia));
    const siglas = siglasPorDia[chave];
    const classes = ['cal-dia'];
    if (chave < hoje) classes.push('passado');
    if (chave === hoje) classes.push('hoje');
    if (siglas) classes.push('treinou');
    const letra = siglas ? `<span class="cal-letra">${esc([...siglas].join(''))}</span>` : '';
    celulas += `<div class="${classes.join(' ')}"${chave === hoje ? ' aria-current="date"' : ''}>${dia}${letra}</div>`;
  }

  $('#titulo-mes', view).innerHTML = tituloMes(mesVisivel);
  $('#resumo-mes', view).textContent = noMesAtual
    ? (daSemana.length ? `${plural(daSemana.length, 'treino', 'treinos')} essa semana` : 'Nenhum treino essa semana')
    : `${plural(doMes.length, 'treino', 'treinos')} em ${MESES[mes]}`;
  $('#calendario', view).innerHTML = `
    <div class="cal-semana">${INICIAIS_SEMANA.map((d) => `<span>${d}</span>`).join('')}</div>
    <div class="cal-grade">${celulas}</div>`;
}

function itemHistorico(item, treinosPorId) {
  if (item.tipo === 'descanso') {
    const dias = diasEntre(item.ini, item.fim) + 1;
    const titulo = dias > 1 ? `Descanso · ${dias} dias` : 'Descanso';
    return `
      <div class="item-historico descanso">
        <div class="selo">—</div>
        <div class="item-texto">
          <div class="item-titulo">${titulo}</div>
          <div class="item-sub">${esc(rotuloIntervalo(item.ini, item.fim))}</div>
        </div>
      </div>`;
  }
  const { sessao } = item;
  const treino = treinosPorId[sessao.treino_id];
  return `
    <div class="item-historico">
      <div class="selo">${esc(treino?.sigla ?? '?')}</div>
      <div class="item-texto">
        <div class="item-titulo">${esc(nomeCompletoTreino(treino))}</div>
        <div class="item-sub">${esc(rotuloDia(sessao.data))} · ${formatarDuracao(duracaoSessao(sessao))}</div>
      </div>
    </div>`;
}

function acaoPrincipal(sugestao) {
  if (!sugestao?.treino) {
    return { legenda: 'Nenhum treino montado ainda', rotulo: 'Montar meus treinos', destino: 'ajustes' };
  }
  const nome = nomeCompletoTreino(sugestao.treino);
  if (sugestao.sessao) {
    return { legenda: `${nome} · em andamento`, rotulo: 'Retomar treino', destino: `treinar/sessao/${sugestao.sessao.id}` };
  }
  return { legenda: nome, rotulo: 'Iniciar treino de hoje', destino: `treinar?treino=${sugestao.treino.id}` };
}

export async function render(view) {
  if (!mesVisivel) {
    const d = new Date();
    mesVisivel = { ano: d.getFullYear(), mes: d.getMonth() };
  }

  const [treinos, historico, sugestao] = await Promise.all([
    listarTreinos(), historicoRecente(6), sugerirTreino(),
  ]);
  const treinosPorId = Object.fromEntries(treinos.map((t) => [t.id, t]));
  const acao = acaoPrincipal(sugestao);

  view.classList.add('com-acao');
  view.innerHTML = `
    <header class="cabecalho">
      <div>
        <h1 class="titulo" id="titulo-mes"></h1>
        <p class="subtitulo" id="resumo-mes"></p>
      </div>
      <div class="cabecalho-acoes">
        <button type="button" class="botao-icone" data-passo="-1" aria-label="Mês anterior">${icone('voltar')}</button>
        <button type="button" class="botao-icone" data-passo="1" aria-label="Próximo mês">${icone('avancar')}</button>
      </div>
    </header>

    <section class="calendario" id="calendario" aria-label="Calendário de treinos"></section>
    <hr class="divisor">

    <h2 class="rotulo-secao">Histórico recente</h2>
    <div class="lista">
      ${historico.length
        ? historico.map((item) => itemHistorico(item, treinosPorId)).join('')
        : '<div class="vazio">Seus treinos concluídos aparecem aqui.</div>'}
    </div>

    <div class="acao-fixa">
      <div class="acao-legenda">${esc(acao.legenda)}</div>
      <button type="button" class="botao botao-primario" id="acao-principal">${esc(acao.rotulo)}</button>
    </div>`;

  await desenharCalendario(view, treinosPorId);

  view.querySelectorAll('[data-passo]').forEach((botao) => {
    botao.onclick = () => {
      const d = new Date(mesVisivel.ano, mesVisivel.mes + Number(botao.dataset.passo), 1);
      mesVisivel = { ano: d.getFullYear(), mes: d.getMonth() };
      desenharCalendario(view, treinosPorId);
    };
  });
  $('#acao-principal', view).onclick = () => ir(acao.destino);
}
