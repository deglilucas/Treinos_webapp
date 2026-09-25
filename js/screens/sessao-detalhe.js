// Detalhe de um treino já concluído: ver e corrigir séries, duração e excluir.
// Aberto a partir do histórico (Início) ou da lista de treinos no Progresso.

import { seriesDaSessao, nomeCompletoTreino, atualizarSerie } from '../db/repo.js';
import { get } from '../db/db.js';
import {
  excluirSessao, adicionarSerieManual, ajustarDuracaoSessao, removerSerieDoHistorico,
} from '../db/edicao.js';
import { rotuloDia } from '../lib/datas.js';
import { duracaoSessao, formatarDuracao, formatarCronometro } from '../lib/timer.js';
import { esc, $, toast } from '../ui/dom.js';
import { icone } from '../ui/icones.js';
import { cabecalhoVoltar, stepper } from '../ui/controles.js';
import { abrirSheet } from '../ui/sheet.js';
import { ir } from '../router.js';

const fmtPeso = (p) => (p == null ? '' : String(p).replace('.', ','));
const lerPeso = (txt) => {
  if (!String(txt).trim()) return null;
  const v = parseFloat(String(txt).replace(',', '.'));
  return Number.isFinite(v) && v >= 0 ? v : undefined;
};
const lerReps = (txt) => {
  const v = parseInt(txt, 10);
  return v > 0 ? v : undefined;
};
/** '1:05' → 65 · '45' → 45 */
const lerDuracao = (txt) => {
  const partes = String(txt).trim().split(':').map((p) => parseInt(p, 10));
  if (partes.some((p) => !Number.isFinite(p) || p < 0)) return undefined;
  const seg = partes.reduce((t, p) => t * 60 + p, 0);
  return seg > 0 ? seg : undefined;
};
const hora = (ms) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export async function render(view, sessaoId, voltarPara) {
  const sessao = await get('sessoes', sessaoId);
  if (sessao?.status === 'em_andamento') {
    location.replace(`#/treinar/sessao/${sessaoId}`);
    return;
  }
  if (!sessao) {
    location.replace(`#/${voltarPara}`);
    return;
  }
  const treino = await get('treinos', sessao.treino_id);
  let series = await seriesDaSessao(sessao.id);
  const exercicios = new Map();
  await Promise.all([...new Set(series.map((s) => s.exercicio_id))].map(async (id) => {
    exercicios.set(id, await get('exercicios', id));
  }));

  view.innerHTML = `
    ${cabecalhoVoltar(nomeCompletoTreino(treino), voltarPara)}
    <p class="subtitulo detalhe-quando">${esc(rotuloDia(sessao.data))} · ${hora(sessao.hora_inicio)} às ${hora(sessao.hora_fim)}</p>
    <div class="stats" id="stats-sessao"></div>
    <div class="card linha-duracao">
      <span class="config-rotulo">Duração</span>
      ${stepper('duracao', formatarDuracao(duracaoSessao(sessao)), 'duração')}
    </div>
    <div class="lista" id="exercicios-sessao"></div>
    <button type="button" class="botao botao-fantasma" id="excluir-sessao">Excluir este treino</button>`;

  const lista = $('#exercicios-sessao', view);

  function grupos() {
    const porExercicio = new Map();
    for (const s of [...series].sort((a, b) => a.registrada_em - b.registrada_em)) {
      if (!porExercicio.has(s.exercicio_id)) porExercicio.set(s.exercicio_id, []);
      porExercicio.get(s.exercicio_id).push(s);
    }
    return [...porExercicio.entries()].map(([id, lista]) => ({
      exercicio: exercicios.get(id) ?? { id, nome: 'Exercício removido', tipo_registro: lista[0].duracao != null ? 'tempo' : 'peso_reps' },
      series: lista.sort((a, b) => a.numero_serie - b.numero_serie),
    }));
  }

  function desenharStats() {
    const volume = series.reduce((t, s) => t + (s.peso != null && s.reps ? s.peso * s.reps : 0), 0);
    const descansos = series.map((s) => s.descanso_seg).filter((d) => d != null);
    const primeiro = descansos.length
      ? `<div class="stat"><div class="stat-rotulo">Descanso médio</div><div class="stat-valor">${formatarCronometro((descansos.reduce((a, b) => a + b, 0) / descansos.length) * 1000)}</div></div>`
      : `<div class="stat"><div class="stat-rotulo">Exercícios</div><div class="stat-valor">${grupos().length}</div></div>`;
    $('#stats-sessao', view).innerHTML = `
      ${primeiro}
      <div class="stat"><div class="stat-rotulo">Séries</div><div class="stat-valor">${series.length}</div></div>
      <div class="stat"><div class="stat-rotulo">Volume</div><div class="stat-valor">${Math.round(volume).toLocaleString('pt-BR')} kg</div></div>`;
  }

  function htmlLinha(serie, tempo) {
    const campos = tempo
      ? `<input class="campo" name="duracao" inputmode="text" autocomplete="off" value="${formatarCronometro((serie.duracao ?? 0) * 1000)}" aria-label="Duração da série ${serie.numero_serie} (min:seg)">`
      : `<input class="campo" name="peso" inputmode="decimal" autocomplete="off" placeholder="—" value="${esc(fmtPeso(serie.peso))}" aria-label="Peso da série ${serie.numero_serie} em kg">
         <input class="campo" name="reps" inputmode="numeric" autocomplete="off" value="${esc(serie.reps ?? '')}" aria-label="Repetições da série ${serie.numero_serie}">`;
    return `
      <div class="serie feita${tempo ? ' serie-edicao-tempo' : ''}${serie.a_preencher ? ' a-preencher' : ''}" data-serie="${esc(serie.id)}">
        <span class="serie-num">${serie.numero_serie}</span>
        ${campos}
        <button type="button" class="botao-icone botao-icone-perigo" data-remover aria-label="Apagar série ${serie.numero_serie}">${icone('lixeira')}</button>
        ${serie.descanso_seg != null ? `<span class="serie-descanso">descanso depois: ${formatarCronometro(serie.descanso_seg * 1000)}</span>` : ''}
      </div>`;
  }

  function desenhar() {
    const g = grupos();
    lista.innerHTML = g.length ? g.map(({ exercicio, series: doEx }) => {
      const tempo = exercicio.tipo_registro === 'tempo';
      return `
        <article class="card card-exercicio" data-exercicio="${esc(exercicio.id)}">
          <h3 class="ex-nome">${esc(exercicio.nome)}</h3>
          ${tempo
            ? '<div class="series-cab series-cab-tempo"><span>Série</span><span>Tempo</span><span></span></div>'
            : '<div class="series-cab"><span>Série</span><span>kg</span><span>Reps</span><span></span></div>'}
          <div class="series">${doEx.map((s) => htmlLinha(s, tempo)).join('')}</div>
          <button type="button" class="botao-texto" data-mais>${icone('mais')}Série</button>
        </article>`;
    }).join('') : '<div class="vazio">Esse treino ficou sem séries.</div>';
    desenharStats();
  }
  desenhar();

  // Corrigir valores: salva ao sair do campo; valor inválido volta ao anterior.
  lista.addEventListener('change', async (e) => {
    const linha = e.target.closest('.serie');
    if (!linha) return;
    const serie = series.find((s) => s.id === linha.dataset.serie);
    const campo = e.target;
    let mudanca;
    if (campo.name === 'peso') mudanca = { peso: lerPeso(campo.value) };
    else if (campo.name === 'reps') mudanca = { reps: lerReps(campo.value), a_preencher: false };
    else mudanca = { duracao: lerDuracao(campo.value) };
    if (Object.values(mudanca)[0] === undefined) {
      campo.value = campo.name === 'duracao' ? formatarCronometro(serie.duracao * 1000)
        : campo.name === 'peso' ? fmtPeso(serie.peso) : serie.reps;
      toast('Valor inválido, mantive o anterior');
      return;
    }
    const salva = await atualizarSerie(serie.id, mudanca);
    series = series.map((s) => (s.id === salva.id ? salva : s));
    if (!salva.a_preencher) linha.classList.remove('a-preencher');
    if (campo.name === 'duracao') campo.value = formatarCronometro(salva.duracao * 1000);
    desenharStats();
  });

  lista.addEventListener('click', async (e) => {
    const remover = e.target.closest('[data-remover]');
    if (remover) {
      const id = remover.closest('.serie').dataset.serie;
      await removerSerieDoHistorico(id);
      series = await seriesDaSessao(sessao.id);
      desenhar();
      return;
    }
    const mais = e.target.closest('[data-mais]');
    if (mais) {
      const exercicioId = mais.closest('.card-exercicio').dataset.exercicio;
      const ultima = grupos().find((g) => g.exercicio.id === exercicioId).series.at(-1);
      const nova = await adicionarSerieManual(sessao.id, exercicioId, {
        peso: ultima?.peso, reps: ultima?.reps, duracao: ultima?.duracao,
      });
      series = [...series, nova];
      desenhar();
    }
  });

  // Duração em passos de 5 minutos.
  $('.linha-duracao', view).addEventListener('click', async (e) => {
    const botao = e.target.closest('[data-delta]');
    if (!botao) return;
    const atual = duracaoSessao(sessao);
    const passo = 5 * 60000;
    const nova = Math.min(5 * 3600000, Math.max(passo, Math.round(atual / passo) * passo + Number(botao.dataset.delta) * passo));
    Object.assign(sessao, await ajustarDuracaoSessao(sessao.id, nova));
    $('.linha-duracao .stepper-valor', view).textContent = formatarDuracao(duracaoSessao(sessao));
    $('.detalhe-quando', view).textContent = `${rotuloDia(sessao.data)} · ${hora(sessao.hora_inicio)} às ${hora(sessao.hora_fim)}`;
  });

  $('#excluir-sessao', view).onclick = async () => {
    const ok = await abrirSheet({
      titulo: 'Excluir este treino?',
      texto: 'Ele sai do histórico e do Progresso, com todas as séries.',
      acoes: [{ id: 'sim', rotulo: 'Excluir treino' }],
    });
    if (!ok) return;
    await excluirSessao(sessao.id);
    ir(voltarPara);
    toast('Treino excluído do histórico');
  };
}
