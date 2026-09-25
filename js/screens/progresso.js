// Progresso: evolução por exercício (com período) e volume/séries por grupo muscular na semana.
// Subtela: #/progresso/sessao/:id (detalhe de um treino feito).

import {
  carregarHistorico, exerciciosComHistorico, evolucaoExercicio, resumoPeriodo,
} from '../db/analise.js';
import { GRUPOS } from '../db/seed.js';
import {
  chaveData, somarDias, semanaDe, deChave, rotuloDia, rotuloIntervalo,
} from '../lib/datas.js';
import { formatarCronometro } from '../lib/timer.js';
import { esc, $ } from '../ui/dom.js';
import { icone } from '../ui/icones.js';
import { chips } from '../ui/controles.js';
import { graficoLinha } from '../ui/grafico.js';
import { listarMedidas, INDICADORES, valorDe } from '../db/medidas.js';
import * as detalhe from './sessao-detalhe.js';
import * as formMedidas from './medidas-form.js';

// Escolhas da tela sobrevivem à troca de abas.
const estado = {
  vista: 'exercicios',
  periodo: '90',
  exercicioId: null,
  metrica: {},            // por exercício
  semana: null,           // início (domingo) da semana exibida
  medidaGrupo: 'series',
  indicador: 'peso_corporal',
};

const PERIODOS = [
  { valor: '30', rotulo: '30 dias' },
  { valor: '90', rotulo: '3 meses' },
  { valor: '180', rotulo: '6 meses' },
  { valor: '365', rotulo: '1 ano' },
  { valor: 'tudo', rotulo: 'Tudo' },
];

// Grupos que entram no "sem séries na semana" (cardio, funcional e alongamento ficam de fora).
const GRUPOS_MUSCULARES = GRUPOS.filter((g) => !['Cardio', 'Funcional', 'Alongamento'].includes(g));

// Redesenho do gráfico atual (ao girar a tela). A vista de grupos não tem gráfico SVG.
let redesenharGrafico = null;

const numero = (v, casas = 1) => v.toLocaleString('pt-BR', { maximumFractionDigits: casas });
const kg = (v) => `${numero(v)} kg`;
/** Para os cards pequenos: 20835 → '20,8 mil' (a unidade vai no rótulo). */
const compacto = (v) => (Math.abs(v) >= 10000 ? `${numero(v / 1000)} mil` : numero(Math.round(v), 0));
const dataCurta = (chave) => `${chave.slice(8, 10)}/${chave.slice(5, 7)}`;
const sinal = (v, fmt) => (v > 0 ? `+${fmt(v)}` : v < 0 ? `−${fmt(-v)}` : 'igual');

/** Métricas disponíveis conforme o tipo do exercício. */
function metricasDe(exercicio, pontos) {
  if (exercicio.tipo_registro === 'tempo') {
    const seg = (v) => formatarCronometro(v * 1000);
    return [
      { id: 'maxDuracao', rotulo: 'Maior tempo', formatar: seg },
      { id: 'totalDuracao', rotulo: 'Tempo total', formatar: seg, zero: true },
    ];
  }
  if (!pontos.some((p) => p.carga != null)) {
    return [
      { id: 'maxReps', rotulo: 'Máx. reps', formatar: (v) => `${v} reps` },
      { id: 'totalReps', rotulo: 'Total de reps', formatar: (v) => `${v} reps`, zero: true },
    ];
  }
  return [
    { id: 'carga', rotulo: 'Maior carga', formatar: kg },
    { id: 'e1rm', rotulo: '1RM estimado', formatar: (v) => kg(Math.round(v * 2) / 2) },
    { id: 'volume', rotulo: 'Volume', formatar: (v) => kg(Math.round(v)), zero: true },
  ];
}

function resumoSeries(ponto, exercicio) {
  if (exercicio.tipo_registro === 'tempo') {
    return ponto.series.map((s) => formatarCronometro((s.duracao ?? 0) * 1000)).join(' · ');
  }
  return ponto.series
    .map((s) => (s.peso != null ? `${numero(s.peso)}×${s.reps}` : `${s.reps}`))
    .join(' · ') + (ponto.series.every((s) => s.peso == null) ? ' reps' : '');
}

function statTile(rotulo, valor, apoio = '') {
  return `
    <div class="stat">
      <div class="stat-rotulo">${esc(rotulo)}</div>
      <div class="stat-valor">${esc(valor)}</div>
      ${apoio ? `<div class="stat-apoio">${esc(apoio)}</div>` : ''}
    </div>`;
}

// ---------- Vista por exercício ----------

function vistaExercicios(el, h) {
  const disponiveis = exerciciosComHistorico(h);
  if (!disponiveis.some((d) => d.exercicio.id === estado.exercicioId)) estado.exercicioId = disponiveis[0].exercicio.id;
  const exercicio = h.exercicios.get(estado.exercicioId);
  const desde = estado.periodo === 'tudo' ? null : somarDias(chaveData(), -Number(estado.periodo));
  const pontos = evolucaoExercicio(h, exercicio.id, desde);
  const todos = desde ? evolucaoExercicio(h, exercicio.id) : pontos;
  const metricas = metricasDe(exercicio, todos);
  const metrica = metricas.find((m) => m.id === estado.metrica[exercicio.id]) ?? metricas[0];
  const validos = pontos.filter((p) => p[metrica.id] != null);

  let corpo;
  if (!validos.length) {
    corpo = `<div class="vazio">Nenhum registro desse exercício no período. Tente um período maior.</div>`;
  } else {
    const valores = validos.map((p) => p[metrica.id]);
    const melhor = Math.max(...valores);
    const ultimo = validos.at(-1);
    const variacao = valores.at(-1) - valores[0];
    corpo = `
      <div class="stats">
        ${statTile('Melhor no período', metrica.formatar(melhor))}
        ${statTile('Última vez', metrica.formatar(ultimo[metrica.id]), dataCurta(ultimo.data))}
        ${statTile('Variação', validos.length > 1 ? sinal(variacao, metrica.formatar) : '—', validos.length > 1 ? `desde ${dataCurta(validos[0].data)}` : '')}
      </div>
      ${validos.length > 1
        ? '<div class="card grafico" id="grafico"></div>'
        : '<div class="vazio">Só tem um treino no período. Com o próximo, o gráfico aparece aqui.</div>'}
      <h2 class="rotulo-secao">Treinos no período</h2>
      <div class="lista">
        ${[...validos].reverse().map((p) => `
          <a class="item-historico item-link item-compacto" href="#/progresso/sessao/${esc(p.sessao.id)}">
            <div class="item-texto">
              <div class="item-titulo">${esc(rotuloDia(p.data))}</div>
              <div class="item-sub">${esc(resumoSeries(p, exercicio))}</div>
            </div>
            <div class="item-valor">${esc(metrica.formatar(p[metrica.id]))}</div>
            ${icone('avancar')}
          </a>`).join('')}
      </div>`;
  }

  el.innerHTML = `
    ${chips('periodo', PERIODOS, estado.periodo)}
    <label class="campo-rotulo seletor-exercicio">Exercício
      <select class="entrada" id="escolha-exercicio">
        ${disponiveis.map((d) => `<option value="${esc(d.exercicio.id)}"${d.exercicio.id === exercicio.id ? ' selected' : ''}>${esc(d.exercicio.nome)}</option>`).join('')}
      </select>
    </label>
    ${metricas.length > 1 ? `
      <div class="segmentado segmentado-${metricas.length}" role="group" aria-label="Medida">
        ${metricas.map((m) => `<button type="button" data-metrica="${m.id}" aria-pressed="${m.id === metrica.id}">${m.rotulo}</button>`).join('')}
      </div>` : ''}
    ${corpo}`;

  const desenharGrafico = () => {
    const alvo = $('#grafico', el);
    if (!alvo) return;
    graficoLinha(alvo, validos.map((p) => ({
      t: p.sessao.hora_inicio,
      y: p[metrica.id],
      rotuloData: dataCurta(p.data),
      detalhe: resumoSeries(p, exercicio),
    })), { formatar: metrica.formatar, formatarEixo: (v) => numero(v, 0), zeroNaBase: !!metrica.zero });
  };
  desenharGrafico();
  redesenharGrafico = desenharGrafico;

  el.querySelector('[data-chips=periodo]').onclick = (e) => {
    const chip = e.target.closest('.chip-filtro');
    if (!chip) return;
    estado.periodo = chip.dataset.valor;
    vistaExercicios(el, h);
  };
  $('#escolha-exercicio', el).onchange = (e) => {
    estado.exercicioId = e.target.value;
    vistaExercicios(el, h);
  };
  el.querySelectorAll('[data-metrica]').forEach((b) => {
    b.onclick = () => {
      estado.metrica[exercicio.id] = b.dataset.metrica;
      vistaExercicios(el, h);
    };
  });
}

// ---------- Vista por grupo muscular ----------

function vistaGrupos(el, h) {
  redesenharGrafico = null;
  const semanaAtual = semanaDe(chaveData()).inicio;
  estado.semana ??= semanaAtual;
  const ini = estado.semana;
  const fim = somarDias(ini, 6);
  const atual = resumoPeriodo(h, ini, fim);
  const anterior = resumoPeriodo(h, somarDias(ini, -7), somarDias(ini, -1));
  const porSeries = estado.medidaGrupo === 'series';
  const valor = (g) => (porSeries ? g.series : g.volume);
  const formatar = (v) => (porSeries ? (v === 1 ? '1 série' : `${v} séries`) : kg(Math.round(v)));

  const linhas = atual.grupos.filter((g) => valor(g) > 0).sort((a, b) => valor(b) - valor(a));
  const maximo = Math.max(1, ...linhas.map(valor));
  const semSeries = GRUPOS_MUSCULARES.filter((g) => !atual.grupos.some((x) => x.grupo === g));
  const titulo = ini === semanaAtual ? 'Esta semana' : ini === somarDias(semanaAtual, -7) ? 'Semana passada' : 'Semana';
  const delta = (a, b, fmt) => (anterior.sessoes ? `${sinal(a - b, fmt)} vs anterior` : '');

  el.innerHTML = `
    <div class="navegador-semana">
      <button type="button" class="botao-icone" data-semana="-7" aria-label="Semana anterior">${icone('voltar')}</button>
      <div class="navegador-texto">
        <div class="item-titulo">${titulo}</div>
        <div class="item-sub">${esc(rotuloIntervalo(ini, fim))}</div>
      </div>
      <button type="button" class="botao-icone" data-semana="7" aria-label="Próxima semana" ${ini >= semanaAtual ? 'disabled' : ''}>${icone('avancar')}</button>
    </div>

    <div class="stats">
      ${statTile('Séries', String(atual.totalSeries), delta(atual.totalSeries, anterior.totalSeries, String))}
      ${statTile('Volume (kg)', compacto(atual.totalVolume), delta(atual.totalVolume, anterior.totalVolume, compacto))}
      ${statTile('Treinos', String(atual.sessoes))}
    </div>

    <div class="segmentado" role="group" aria-label="Medida">
      <button type="button" data-medida="series" aria-pressed="${porSeries}">Séries</button>
      <button type="button" data-medida="volume" aria-pressed="${!porSeries}">Volume</button>
    </div>

    ${linhas.length ? `
      <div class="card barras" role="list">
        ${linhas.map((g) => `
          <button type="button" class="barra-linha" role="listitem" aria-expanded="false">
            <span class="barra-rotulo">${esc(g.grupo)}</span>
            <span class="barra-trilho"><span class="barra" style="width: ${(valor(g) / maximo) * 100}%"></span></span>
            <span class="barra-valor">${esc(formatar(valor(g)))}</span>
            <span class="barra-detalhe" hidden>${esc([...g.exercicios].map((id) => h.exercicios.get(id)?.nome ?? 'Exercício removido').join(' · '))}</span>
          </button>`).join('')}
      </div>` : '<div class="vazio">Nenhuma série nessa semana.</div>'}
    ${!porSeries && linhas.length ? '<p class="texto-apoio fraco nota-grafico">Volume = peso × reps. Exercícios de tempo e sem carga não entram.</p>' : ''}
    ${semSeries.length && atual.totalSeries ? `<p class="texto-apoio nota-grafico">Sem séries na semana: ${esc(semSeries.join(', '))}</p>` : ''}`;

  el.querySelectorAll('[data-semana]').forEach((b) => {
    b.onclick = () => {
      estado.semana = somarDias(estado.semana, Number(b.dataset.semana));
      vistaGrupos(el, h);
    };
  });
  el.querySelectorAll('[data-medida]').forEach((b) => {
    b.onclick = () => {
      estado.medidaGrupo = b.dataset.medida;
      vistaGrupos(el, h);
    };
  });
  // Toque na barra mostra quais exercícios entraram na conta.
  el.querySelectorAll('.barra-linha').forEach((linha) => {
    linha.onclick = () => {
      const aberto = linha.getAttribute('aria-expanded') === 'true';
      linha.setAttribute('aria-expanded', String(!aberto));
      linha.querySelector('.barra-detalhe').hidden = aberto;
    };
  });
}

// ---------- Vista do corpo (medidas) ----------

function vistaCorpo(el, medidas) {
  redesenharGrafico = null;
  const botaoNovo = `<a class="botao botao-novo-registro" href="#/progresso/medidas/nova">${icone('mais')}Registrar medidas</a>`;
  if (!medidas.length) {
    el.innerHTML = `${botaoNovo}<div class="vazio vazio-corpo">Registre peso e medidas de tempos em tempos pra acompanhar a evolução aqui.</div>`;
    return;
  }

  const disponiveis = INDICADORES.filter((ind) => medidas.some((m) => valorDe(m, ind.id) != null));
  if (!disponiveis.some((d) => d.id === estado.indicador)) estado.indicador = disponiveis[0].id;
  const ind = disponiveis.find((d) => d.id === estado.indicador);
  const formatar = (v) => `${numero(v)} ${ind.unidade}`;
  const pontos = medidas.filter((m) => valorDe(m, ind.id) != null);
  const primeiro = pontos[0];
  const ultimo = pontos.at(-1);
  const variacao = valorDe(ultimo, ind.id) - valorDe(primeiro, ind.id);

  const resumo = (m) => {
    const partes = [];
    if (m.peso_corporal != null) partes.push(`${numero(m.peso_corporal)} kg`);
    const outras = Object.keys(m.medidas ?? {}).length;
    if (outras) partes.push(outras === 1 ? '1 medida' : `${outras} medidas`);
    return partes.join(' · ');
  };

  el.innerHTML = `
    ${botaoNovo}
    ${chips('indicador', disponiveis.map((d) => ({ valor: d.id, rotulo: d.rotulo })), ind.id)}
    <div class="stats">
      ${statTile('Atual', formatar(valorDe(ultimo, ind.id)), dataCurta(ultimo.data))}
      ${statTile('Variação', pontos.length > 1 ? sinal(variacao, formatar) : '—', pontos.length > 1 ? `desde ${dataCurta(primeiro.data)}` : '')}
      ${statTile('Registros', String(pontos.length))}
    </div>
    ${pontos.length > 1
      ? '<div class="card grafico" id="grafico"></div>'
      : '<div class="vazio">Com o próximo registro, o gráfico aparece aqui.</div>'}
    <h2 class="rotulo-secao">Registros</h2>
    <div class="lista">
      ${[...medidas].reverse().map((m) => `
        <a class="item-historico item-link item-compacto" href="#/progresso/medidas/${esc(m.id)}">
          <div class="item-texto">
            <div class="item-titulo">${esc(rotuloDia(m.data))}</div>
            <div class="item-sub">${esc(resumo(m))}</div>
          </div>
          ${valorDe(m, ind.id) != null ? `<div class="item-valor">${esc(formatar(valorDe(m, ind.id)))}</div>` : ''}
          ${icone('avancar')}
        </a>`).join('')}
    </div>`;

  const desenhar = () => {
    const alvo = $('#grafico', el);
    if (!alvo) return;
    graficoLinha(alvo, pontos.map((m) => ({
      t: deChave(m.data).getTime(),
      y: valorDe(m, ind.id),
      rotuloData: dataCurta(m.data),
    })), { formatar, formatarEixo: (v) => numero(v, 1) });
  };
  desenhar();
  redesenharGrafico = desenhar;

  el.querySelector('[data-chips=indicador]').onclick = (e) => {
    const chip = e.target.closest('.chip-filtro');
    if (!chip) return;
    estado.indicador = chip.dataset.valor;
    vistaCorpo(el, medidas);
  };
}

// ---------- Tela ----------

export async function render(view, rota) {
  if (rota?.params?.[0] === 'sessao' && rota.params[1]) return detalhe.render(view, rota.params[1], 'progresso');
  if (rota?.params?.[0] === 'medidas' && rota.params[1]) return formMedidas.render(view, rota.params[1]);

  const [h, medidas] = await Promise.all([carregarHistorico(), listarMedidas()]);
  view.innerHTML = `
    <h1 class="titulo">Progresso</h1>
    <div class="segmentado segmentado-3 vista-progresso" role="group" aria-label="Visão">
      <button type="button" data-vista="exercicios" aria-pressed="${estado.vista === 'exercicios'}">Exercícios</button>
      <button type="button" data-vista="grupos" aria-pressed="${estado.vista === 'grupos'}">Grupos</button>
      <button type="button" data-vista="corpo" aria-pressed="${estado.vista === 'corpo'}">Corpo</button>
    </div>
    <div id="conteudo-progresso"></div>`;

  const conteudo = $('#conteudo-progresso', view);

  const mostrar = () => {
    view.querySelectorAll('[data-vista]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.vista === estado.vista)));
    if (estado.vista === 'corpo') vistaCorpo(conteudo, medidas);
    else if (!h.series.length) {
      redesenharGrafico = null;
      conteudo.innerHTML = '<div class="vazio vazio-corpo">Conclua um treino e a sua evolução aparece aqui.</div>';
    } else if (estado.vista === 'exercicios') vistaExercicios(conteudo, h);
    else vistaGrupos(conteudo, h);
  };
  view.querySelectorAll('[data-vista]').forEach((b) => {
    b.onclick = () => { estado.vista = b.dataset.vista; mostrar(); };
  });
  mostrar();

  // O gráfico é desenhado na largura real; ao girar a tela, redesenha.
  let espera;
  const aoRedimensionar = () => {
    clearTimeout(espera);
    espera = setTimeout(() => redesenharGrafico?.(), 150);
  };
  window.addEventListener('resize', aoRedimensionar);
  return () => window.removeEventListener('resize', aoRedimensionar);
}
