// Execução do treino: lista de exercícios com as séries dentro de cada card.
//
// Nenhuma fase termina sozinha. Série de tempo e descanso contam o tempo que
// passou; o alvo serve só para apitar. Quem avança é o toque:
// - terminar uma série (check ou parar) sempre abre um descanso, inclusive
//   entre um exercício e outro; só a última série do treino não abre, e aí o
//   app pergunta se quer concluir;
// - o descanso vai até o toque em "Iniciar série" (ou até registrar a próxima)
//   e a duração real fica gravada na série que o abriu.

import {
  obterSessao, retomarSessao, pausarSessao, concluirSessao, cancelarSessao,
  exerciciosDoTreino, seriesDaSessao, ultimaReferencia, registrarSerie,
  atualizarSerie, removerSerie, encerrarDescanso, ajustarDescanso,
  iniciarSerieTempo, descartarSerieTempo, nomeCompletoTreino, salvarRascunhos,
} from '../db/repo.js';
import { get } from '../db/db.js';
import {
  criarTicker, duracaoSessao, decorrido, formatarCronometro,
  formatarDuracao, formatarSegundos,
} from '../lib/timer.js';
import { montarMidia } from '../lib/midia.js';
import { prepararAudio, alertar } from '../lib/alerta.js';
import { deveOferecer, marcarOferecido, ativar } from '../lib/notificacoes.js';
import { esc, $, toast } from '../ui/dom.js';
import { icone } from '../ui/icones.js';
import { abrirSheet } from '../ui/sheet.js';
import { ir } from '../router.js';

// Se o alvo de um timer foi cruzado há mais tempo que isso, o app estava em
// segundo plano: não apita atrasado, só atualiza a tela.
const TOLERANCIA_ALERTA_MS = 3000;

const fmtPeso = (p) => (p == null ? '' : String(p).replace('.', ','));
const lerPeso = (txt) => {
  const v = parseFloat(String(txt).replace(',', '.'));
  return Number.isFinite(v) && v >= 0 ? v : null;
};
const lerReps = (txt) => {
  const v = parseInt(txt, 10);
  return v > 0 ? v : null;
};
const dataCurta = (chave) => `${chave.slice(8, 10)}/${chave.slice(5, 7)}`;

function resumoReferencia(ref, tipo) {
  if (!ref?.series.length) return 'Primeira vez';
  const quando = dataCurta(ref.data);
  if (tipo === 'tempo') {
    const maior = Math.max(...ref.series.map((s) => s.duracao ?? 0));
    return `Última (${quando}): ${formatarCronometro(maior * 1000)} · ${ref.series.length} séries`;
  }
  const melhor = ref.series.reduce((a, b) => {
    const pa = a.peso ?? 0;
    const pb = b.peso ?? 0;
    return pb > pa || (pb === pa && (b.reps ?? 0) > (a.reps ?? 0)) ? b : a;
  });
  const carga = melhor.peso != null ? `${fmtPeso(melhor.peso)} kg × ${melhor.reps}` : `${melhor.reps} reps`;
  return `Última (${quando}): ${carga} · ${ref.series.length} séries`;
}

export async function render(view, sessaoId) {
  let sessao = await obterSessao(sessaoId);
  if (sessao?.status !== 'em_andamento') {
    location.replace('#/treinar');
    return;
  }
  // Voltar para a tela é retomar o treino pausado.
  if (sessao.pausado_em) sessao = await retomarSessao(sessao.id);

  const [treino, itens, seriesIniciais] = await Promise.all([
    get('treinos', sessao.treino_id),
    exerciciosDoTreino(sessao.treino_id),
    seriesDaSessao(sessao.id),
  ]);
  const refs = new Map(await Promise.all(
    itens.map(async (item) => [item.id, await ultimaReferencia(item.exercicio_id, sessao.id)]),
  ));

  let series = seriesIniciais;
  const extras = {};             // séries adicionadas além do planejado, por item
  // Valores digitados e ainda não registrados; voltam da sessão salva.
  const rascunhos = new Map(Object.entries(sessao.rascunhos ?? {}));
  let esperaRascunho = null; // gravação pendente (só grava o que mudou aqui, nunca por cima da notificação)
  const persistirRascunhos = () => {
    clearTimeout(esperaRascunho);
    esperaRascunho = null;
    salvarRascunhos(sessao.id, Object.fromEntries(rascunhos)).catch(() => {});
  };
  const agendarRascunhos = () => {
    clearTimeout(esperaRascunho);
    esperaRascunho = setTimeout(persistirRascunhos, 300);
  };
  const pesoDigitado = new Set(); // linhas cujo peso você mexeu (não recebem o de cima)
  const itemPorId = new Map(itens.map((i) => [i.id, i]));

  // ---------- Modelo das linhas ----------

  const seriesDo = (item) => series
    .filter((s) => s.exercicio_id === item.exercicio_id)
    .sort((a, b) => a.numero_serie - b.numero_serie);

  function linhasDo(item) {
    const feitas = seriesDo(item);
    const porNumero = new Map(feitas.map((s) => [s.numero_serie, s]));
    const maior = feitas.reduce((m, s) => Math.max(m, s.numero_serie), 0);
    const total = Math.max(item.series + (extras[item.id] ?? 0), maior);
    return Array.from({ length: total }, (_, i) => ({ numero: i + 1, serie: porNumero.get(i + 1) ?? null }));
  }

  const contarPendentes = () =>
    itens.reduce((soma, item) => soma + linhasDo(item).filter((l) => !l.serie).length, 0);

  const alvoSeg = (item) => item.duracao_alvo ?? item.exercicio.duracao_alvo ?? 60;

  /**
   * Valores pré-preenchidos, campo a campo: o que você digitou > série anterior
   * de hoje > mesma série da última vez.
   */
  function sugestao(item, numero) {
    const rascunho = rascunhos.get(`${item.id}:${numero}`) ?? {};
    const anterior = seriesDo(item).filter((s) => s.numero_serie < numero).at(-1);
    const ref = refs.get(item.id)?.series ?? [];
    const base = anterior ?? ref.find((s) => s.numero_serie === numero) ?? ref.at(-1);
    return {
      peso: rascunho.peso !== undefined && rascunho.peso !== '' ? rascunho.peso : fmtPeso(base?.peso),
      reps: rascunho.reps !== undefined && rascunho.reps !== '' ? rascunho.reps : base?.reps ?? '',
    };
  }

  // ---------- HTML ----------

  function htmlLinhaPesoReps(item, { numero, serie }) {
    const valores = serie ? { peso: fmtPeso(serie.peso), reps: serie.reps } : sugestao(item, numero);
    return `
      <div class="serie${serie ? ' feita' : ''}" data-num="${numero}"${serie ? ` data-serie="${serie.id}"` : ''}>
        <span class="serie-num">${numero}</span>
        <input class="campo" name="peso" inputmode="decimal" autocomplete="off" placeholder="—"
          value="${esc(valores.peso)}" aria-label="Peso da série ${numero} em kg">
        <input class="campo" name="reps" inputmode="numeric" autocomplete="off" placeholder="—"
          value="${esc(valores.reps)}" aria-label="Repetições da série ${numero}">
        <button type="button" class="serie-check" data-acao="${serie ? 'desfazer' : 'registrar'}"
          aria-label="${serie ? `Desfazer série ${numero}` : `Registrar série ${numero}`}">${icone('check')}</button>
      </div>`;
  }

  function htmlLinhaTempo(item, { numero, serie }) {
    const emCurso = sessao.serie_em_curso;
    const rodando = !serie && emCurso?.exercicio_id === item.exercicio_id && emCurso.numero_serie === numero;
    let texto = formatarCronometro(alvoSeg(item) * 1000);
    let acao = 'iniciar-tempo';
    let ic = 'play';
    let rotulo = `Iniciar série ${numero}`;
    if (serie) {
      texto = formatarCronometro((serie.duracao ?? 0) * 1000);
      acao = 'desfazer'; ic = 'check'; rotulo = `Desfazer série ${numero}`;
    } else if (rodando) {
      texto = formatarCronometro(decorrido(emCurso.inicio));
      acao = 'parar-tempo'; ic = 'parar'; rotulo = `Encerrar série ${numero}`;
    }
    const alvo = `alvo ${formatarCronometro(alvoSeg(item) * 1000)}`;
    const classes = ['serie', 'tempo', serie && 'feita', rodando && 'rodando'].filter(Boolean).join(' ');
    return `
      <div class="${classes}" data-num="${numero}"${serie ? ` data-serie="${serie.id}"` : ''}>
        <span class="serie-num">${numero}</span>
        <span class="serie-tempo" data-cronometro>${texto}</span>
        <span class="serie-tempo-rotulo">${serie ? 'feito' : rodando ? alvo : 'alvo'}</span>
        <button type="button" class="serie-check" data-acao="${acao}" aria-label="${rotulo}">${icone(ic)}</button>
      </div>`;
  }

  function htmlCard(item) {
    const ex = item.exercicio;
    const tempo = ex.tipo_registro === 'tempo';
    const meta = tempo
      ? `${item.series} × ${formatarCronometro(alvoSeg(item) * 1000)}`
      : `${item.series} séries`;
    return `
      <article class="card card-exercicio" data-item="${item.id}">
        <div class="ex-topo">
          <button type="button" class="midia midia-mini" data-acao="gif" aria-expanded="false"
            aria-label="Ver execução: ${esc(ex.nome)}"></button>
          <div class="ex-info">
            <h3 class="ex-nome">${esc(ex.nome)}</h3>
            <div class="ex-meta">${meta} · descanso ${formatarSegundos(item.descanso_padrao)}</div>
            <div class="ex-ref">${esc(resumoReferencia(refs.get(item.id), ex.tipo_registro))}</div>
          </div>
        </div>
        <div class="midia midia-grande" hidden></div>
        ${tempo ? '' : '<div class="series-cab"><span>Série</span><span>kg</span><span>Reps</span><span></span></div>'}
        <div class="series"></div>
        <button type="button" class="botao-texto" data-acao="mais-serie">${icone('mais')}Série</button>
      </article>`;
  }

  const cardDe = (item) => view.querySelector(`.card-exercicio[data-item="${item.id}"]`);

  function desenharSeries(item) {
    const html = item.exercicio.tipo_registro === 'tempo' ? htmlLinhaTempo : htmlLinhaPesoReps;
    cardDe(item).querySelector('.series').innerHTML = linhasDo(item).map((l) => html(item, l)).join('');
    const feitas = series.length;
    $('#progresso-series', view).textContent = `${feitas} de ${feitas + contarPendentes()} séries`;
    view.querySelector('.serie.proxima')?.classList.remove('proxima');
    view.querySelector('.serie:not(.feita)')?.classList.add('proxima');
  }

  // ---------- Esqueleto da tela ----------

  view.innerHTML = `
    <header class="sessao-topo">
      <div class="selo">${esc(treino?.sigla ?? '?')}</div>
      <div class="item-texto">
        <div class="item-titulo">${esc(nomeCompletoTreino(treino))}</div>
        <div class="item-sub" id="progresso-series"></div>
      </div>
      <button type="button" class="botao-icone" id="menu-sessao" aria-label="Opções do treino">${icone('menu')}</button>
    </header>
    <div class="cronometro-treino">
      <span class="cronometro-valor" id="duracao-treino">0:00</span>
      <span class="cronometro-rotulo">duração</span>
    </div>

    <div class="lista" id="lista-exercicios">
      ${itens.length ? itens.map(htmlCard).join('') : '<div class="vazio">Esse treino não tem exercícios. Monte ele em Ajustes.</div>'}
    </div>

    <button type="button" class="botao botao-primario concluir" id="concluir">Concluir treino</button>

    <div class="barra-descanso" id="descanso" hidden>
      <div class="descanso-progresso"><span id="descanso-barra"></span></div>
      <div class="descanso-linha">
        <div>
          <div class="descanso-rotulo">Descanso</div>
          <div class="descanso-tempo" id="descanso-tempo">0:00</div>
          <div class="descanso-alvo" id="descanso-alvo"></div>
        </div>
        <div class="descanso-acoes">
          <button type="button" class="chip" data-descanso="-15" aria-label="Diminuir alvo em 15 segundos">−15s</button>
          <button type="button" class="chip" data-descanso="15" aria-label="Aumentar alvo em 15 segundos">+15s</button>
          <button type="button" class="chip chip-destaque" data-descanso="iniciar">Iniciar série</button>
        </div>
      </div>
    </div>`;

  itens.forEach((item) => {
    desenharSeries(item);
    montarMidia(cardDe(item).querySelector('.midia-mini'), item.exercicio);
  });
  if (!itens.length) $('#progresso-series', view).textContent = 'Sem exercícios';

  // ---------- Registro ----------

  async function registrar(item, numero, valores, registradaEm = Date.now()) {
    const restantes = contarPendentes() - 1;
    const r = await registrarSerie({
      sessaoId: sessao.id,
      exercicioId: item.exercicio_id,
      numero,
      ...valores,
      registradaEm,
      descansoSeg: restantes > 0 ? item.descanso_padrao : 0,
    });
    sessao = r.sessao;
    series = [...series, r.serie];
    if (rascunhos.delete(`${item.id}:${numero}`)) persistirRascunhos();
    desenharSeries(item);
    tick(Date.now());
    if (restantes <= 0) perguntarConclusao();
  }

  async function iniciarTempo(item, numero) {
    if (sessao.serie_em_curso) await pararSerieTempo();
    sessao = await iniciarSerieTempo(sessao.id, {
      exercicio_id: item.exercicio_id,
      numero_serie: numero,
      alvo_ms: alvoSeg(item) * 1000,
    });
    desenharSeries(item);
    tick(Date.now());
  }

  async function registrarPesoReps(item, linha) {
    const campoReps = linha.querySelector('[name=reps]');
    const reps = lerReps(campoReps.value);
    if (!reps) {
      campoReps.classList.add('erro');
      campoReps.focus();
      return;
    }
    await registrar(item, Number(linha.dataset.num), {
      peso: lerPeso(linha.querySelector('[name=peso]').value),
      reps,
    });
  }

  /** Toque em parar: registra a duração real (antes ou depois do alvo) e começa o descanso. */
  async function pararSerieTempo() {
    const emCurso = sessao.serie_em_curso;
    if (!emCurso) return;
    const agora = Date.now();
    const item = itens.find((i) => i.exercicio_id === emCurso.exercicio_id);
    const duracao = Math.round((agora - emCurso.inicio) / 1000);
    if (!item || duracao < 1) {
      sessao = await descartarSerieTempo(sessao.id);
      if (item) desenharSeries(item);
      return;
    }
    await registrar(item, emCurso.numero_serie, { duracao }, agora);
  }

  const lista = $('#lista-exercicios', view);

  lista.addEventListener('click', async (e) => {
    const botao = e.target.closest('[data-acao]');
    if (!botao) return;
    const card = botao.closest('.card-exercicio');
    const item = itemPorId.get(card.dataset.item);
    const linha = botao.closest('.serie');
    prepararAudio();

    switch (botao.dataset.acao) {
      case 'gif': {
        const grande = card.querySelector('.midia-grande');
        const abrir = grande.hidden;
        grande.hidden = !abrir;
        botao.setAttribute('aria-expanded', String(abrir));
        if (abrir && !grande.childElementCount) montarMidia(grande, item.exercicio);
        break;
      }
      case 'registrar':
        await registrarPesoReps(item, linha);
        break;
      case 'desfazer': {
        const id = linha.dataset.serie;
        await removerSerie(id);
        series = series.filter((s) => s.id !== id);
        desenharSeries(item);
        break;
      }
      case 'iniciar-tempo':
        await iniciarTempo(item, Number(linha.dataset.num));
        break;
      case 'parar-tempo':
        await pararSerieTempo();
        break;
      case 'mais-serie':
        extras[item.id] = (extras[item.id] ?? 0) + 1;
        desenharSeries(item);
        break;
    }
  });

  lista.addEventListener('input', (e) => {
    const campo = e.target.closest('.campo');
    if (!campo) return;
    campo.classList.remove('erro');
    const linha = campo.closest('.serie');
    if (linha.classList.contains('feita')) return;
    const item = itemPorId.get(campo.closest('.card-exercicio').dataset.item);
    const guardar = (l) => rascunhos.set(`${item.id}:${l.dataset.num}`, {
      peso: l.querySelector('[name=peso]').value,
      reps: l.querySelector('[name=reps]').value,
    });
    guardar(linha);

    // Peso digitado desce para as próximas séries ainda não feitas, até
    // encontrar uma em que você mexeu. As de cima e as já registradas ficam.
    if (campo.name === 'peso') {
      pesoDigitado.add(`${item.id}:${linha.dataset.num}`);
      const num = Number(linha.dataset.num);
      for (const outra of campo.closest('.series').querySelectorAll('.serie:not(.feita)')) {
        if (Number(outra.dataset.num) <= num) continue;
        if (pesoDigitado.has(`${item.id}:${outra.dataset.num}`)) break;
        outra.querySelector('[name=peso]').value = campo.value;
        guardar(outra);
      }
    }
    agendarRascunhos();
  });

  // Corrigir uma série já registrada.
  lista.addEventListener('change', async (e) => {
    const linha = e.target.closest('.serie.feita');
    if (!linha) return;
    const reps = lerReps(linha.querySelector('[name=reps]').value);
    if (!reps) return;
    const atualizada = await atualizarSerie(linha.dataset.serie, {
      peso: lerPeso(linha.querySelector('[name=peso]').value),
      reps,
    });
    if (atualizada) series = series.map((s) => (s.id === atualizada.id ? atualizada : s));
  });

  // ---------- Descanso ----------

  const barra = $('#descanso', view);

  barra.addEventListener('click', async (e) => {
    const botao = e.target.closest('[data-descanso]');
    if (!botao || !sessao.descanso_inicio) return;
    prepararAudio();
    const valor = botao.dataset.descanso;
    if (valor !== 'iniciar') {
      sessao = await ajustarDescanso(sessao.id, Number(valor));
      tick(Date.now());
      return;
    }
    // "Iniciar série": fecha o descanso. Se a próxima série for de tempo, já dá o play nela.
    const proxima = view.querySelector('.serie.proxima');
    const item = proxima && itemPorId.get(proxima.closest('.card-exercicio').dataset.item);
    if (item?.exercicio.tipo_registro === 'tempo') {
      await iniciarTempo(item, Number(proxima.dataset.num));
    } else {
      sessao = await encerrarDescanso(sessao.id, sessao.descanso_inicio);
      tick(Date.now());
    }
    proxima?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  function mostrarDescanso(visivel) {
    barra.hidden = !visivel;
    view.classList.toggle('com-descanso', visivel);
  }

  // ---------- Relógio ----------
  // Tudo é recalculado a partir dos instantes salvos na sessão.

  const elDuracao = $('#duracao-treino', view);

  // Um bipe por alvo: a chave é o instante do alvo, então mudar o alvo
  // (±15s) rearma o aviso.
  const alertados = new Set();
  function apitarSeCruzou(alvoEm, agora) {
    if (agora < alvoEm || alertados.has(alvoEm)) return;
    alertados.add(alvoEm);
    if (agora - alvoEm < TOLERANCIA_ALERTA_MS) alertar();
  }

  function tick(agora) {
    elDuracao.textContent = formatarCronometro(duracaoSessao(sessao, agora));

    const emCurso = sessao.serie_em_curso;
    if (emCurso) {
      const alvoEm = emCurso.inicio + emCurso.alvo_ms;
      apitarSeCruzou(alvoEm, agora);
      const linha = view.querySelector('.serie.rodando');
      if (linha) {
        linha.querySelector('[data-cronometro]').textContent = formatarCronometro(decorrido(emCurso.inicio, agora));
        linha.classList.toggle('passou', agora >= alvoEm);
      }
    }

    if (!sessao.descanso_inicio) return mostrarDescanso(false);
    const alvoEm = sessao.descanso_inicio + sessao.descanso_duracao_ms;
    const passou = agora >= alvoEm;
    apitarSeCruzou(alvoEm, agora);
    mostrarDescanso(true);
    barra.classList.toggle('passou', passou);
    $('#descanso-tempo', view).textContent = formatarCronometro(decorrido(sessao.descanso_inicio, agora));
    $('#descanso-alvo', view).textContent = `alvo ${formatarCronometro(sessao.descanso_duracao_ms)}`;
    const fracao = sessao.descanso_duracao_ms ? decorrido(sessao.descanso_inicio, agora) / sessao.descanso_duracao_ms : 1;
    $('#descanso-barra', view).style.width = `${Math.min(1, fracao) * 100}%`;
  }

  const pararTicker = criarTicker(tick);

  // Ao sair do app, grava na hora o que estava digitado (a notificação usa esses valores).
  const aoEsconder = () => { if (document.visibilityState === 'hidden' && esperaRascunho) persistirRascunhos(); };
  document.addEventListener('visibilitychange', aoEsconder);

  // Mantém a tela acesa durante o treino, onde o navegador suporta.
  let wakeLock = null;
  const pedirWakeLock = async () => {
    if (document.visibilityState !== 'visible') return;
    try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* sem suporte */ }
  };
  document.addEventListener('visibilitychange', pedirWakeLock);
  pedirWakeLock();

  // ---------- Menu e conclusão ----------

  $('#menu-sessao', view).onclick = async () => {
    const escolha = await abrirSheet({
      acoes: [
        { id: 'pausar', rotulo: 'Pausar e sair' },
        { id: 'cancelar', rotulo: 'Cancelar treino', perigo: true },
      ],
    });
    if (escolha === 'pausar') {
      await pausarSessao(sessao.id);
      ir('inicio');
    } else if (escolha === 'cancelar') {
      const ok = await abrirSheet({
        titulo: 'Cancelar treino?',
        texto: 'As séries registradas serão apagadas e esse treino não vai aparecer no histórico.',
        acoes: [{ id: 'sim', rotulo: 'Cancelar treino', perigo: true }],
      });
      if (ok) {
        await cancelarSessao(sessao.id);
        ir('inicio');
        toast('Treino cancelado');
      }
    }
  };

  async function finalizar() {
    const final = await concluirSessao(sessao.id);
    ir('inicio');
    toast(`Treino concluído · ${formatarDuracao(duracaoSessao(final))}`);
  }

  // Depois da última série não há descanso: o treino acaba, mas só com o seu toque.
  async function perguntarConclusao() {
    const ok = await abrirSheet({
      titulo: 'Treino completo',
      texto: 'Todas as séries foram registradas.',
      acoes: [{ id: 'sim', rotulo: 'Concluir treino', primario: true }],
      rotuloFechar: 'Continuar treinando',
    });
    if (ok) await finalizar();
  }

  $('#concluir', view).onclick = async () => {
    if (!series.length) {
      const ok = await abrirSheet({
        titulo: 'Nenhuma série registrada',
        texto: 'Não há nada para salvar. Quer descartar esse treino?',
        acoes: [{ id: 'descartar', rotulo: 'Descartar treino', perigo: true }],
      });
      if (ok) {
        await cancelarSessao(sessao.id);
        ir('inicio');
      }
      return;
    }
    const pendentes = contarPendentes();
    if (pendentes > 0) {
      const ok = await abrirSheet({
        titulo: 'Concluir treino?',
        texto: `Ainda ${pendentes === 1 ? 'falta 1 série' : `faltam ${pendentes} séries`}.`,
        acoes: [{ id: 'sim', rotulo: 'Concluir mesmo assim', primario: true }],
      });
      if (!ok) return;
    }
    await finalizar();
  };

  // Na primeira vez, oferece a notificação com botões (a permissão precisa de um toque).
  (async () => {
    if (!(await deveOferecer())) return;
    await marcarOferecido();
    const ok = await abrirSheet({
      titulo: 'Treino na notificação?',
      texto: 'Com a tela bloqueada, a notificação mostra o descanso ou a série atual, com botão para iniciar ou concluir sem abrir o app. Dá pra mudar depois em Ajustes.',
      acoes: [{ id: 'sim', rotulo: 'Ativar notificação', primario: true }],
      rotuloFechar: 'Agora não',
    });
    if (!ok) return;
    const resultado = await ativar();
    toast(resultado === 'granted' ? 'Notificação ativada' : 'O navegador bloqueou a permissão');
  })();

  return () => {
    pararTicker();
    document.removeEventListener('visibilitychange', aoEsconder);
    if (esperaRascunho) persistirRascunhos();
    document.removeEventListener('visibilitychange', pedirWakeLock);
    wakeLock?.release().catch(() => {});
  };
}
