// Consultas e operações de domínio em cima do IndexedDB.

import { tx, req, get, getAll, getAllPorIndice, put, del, novoId } from './db.js';
import { chaveData, somarDias } from '../lib/datas.js';

// ---------- Treinos ----------

export async function listarTreinos() {
  const treinos = await getAll('treinos');
  return treinos.sort((a, b) => a.ordem - b.ordem);
}

export const nomeCompletoTreino = (treino) =>
  treino ? `Treino ${treino.sigla} — ${treino.nome}` : 'Treino removido';

// ---------- Sessões: consultas ----------

/** Sessões concluídas com data entre `ini` e `fim` (inclusive), em ordem cronológica. */
export async function sessoesEntre(ini, fim) {
  const sessoes = await getAllPorIndice('sessoes', 'data', IDBKeyRange.bound(ini, fim));
  return sessoes
    .filter((s) => s.status === 'concluida')
    .sort((a, b) => a.hora_inicio - b.hora_inicio);
}

export async function sessaoAtiva() {
  const ativas = await getAllPorIndice('sessoes', 'status', 'em_andamento');
  return ativas.sort((a, b) => b.hora_inicio - a.hora_inicio)[0] ?? null;
}

/** Últimas sessões concluídas, da mais recente para a mais antiga. */
export function ultimasSessoes(limite) {
  return tx('sessoes', 'readonly', (t) => new Promise((resolve, reject) => {
    const saida = [];
    const cursor = t.objectStore('sessoes').index('data').openCursor(null, 'prev');
    cursor.onerror = () => reject(cursor.error);
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (!c || saida.length >= limite) return resolve(saida);
      if (c.value.status === 'concluida') saida.push(c.value);
      c.continue();
    };
  })).then((lista) =>
    // Mesmo dia: mais recente primeiro.
    lista.sort((a, b) => b.data.localeCompare(a.data) || b.hora_inicio - a.hora_inicio));
}

/**
 * Histórico para a tela inicial: sessões intercaladas com os intervalos de
 * descanso entre elas. Hoje só conta como descanso depois que acabar.
 * @returns {Promise<Array<{tipo:'sessao', sessao:object} | {tipo:'descanso', ini:string, fim:string}>>}
 */
export async function historicoRecente(limite = 6, hoje = chaveData()) {
  const sessoes = await ultimasSessoes(limite);
  const itens = [];
  let ultimoDiaLivre = somarDias(hoje, -1); // último dia ainda sem treino, voltando no tempo

  for (const sessao of sessoes) {
    const ini = somarDias(sessao.data, 1);
    if (ini <= ultimoDiaLivre) itens.push({ tipo: 'descanso', ini, fim: ultimoDiaLivre });
    itens.push({ tipo: 'sessao', sessao });
    ultimoDiaLivre = somarDias(sessao.data, -1);
  }
  return itens.slice(0, limite);
}

/**
 * Treino sugerido para hoje: o que está em andamento, senão o próximo da
 * rotação depois do último concluído (A → B → C → A).
 */
export async function sugerirTreino() {
  const [treinos, ativa] = await Promise.all([listarTreinos(), sessaoAtiva()]);
  if (!treinos.length) return null;
  if (ativa) {
    return { treino: treinos.find((t) => t.id === ativa.treino_id) ?? null, sessao: ativa };
  }
  const [ultima] = await ultimasSessoes(1);
  const i = ultima ? treinos.findIndex((t) => t.id === ultima.treino_id) : -1;
  return { treino: treinos[(i + 1) % treinos.length], sessao: null };
}

// ---------- Sessões: ciclo de vida ----------

/** Cria a sessão em rascunho. Se já houver uma em andamento, devolve ela. */
export async function iniciarSessao(treinoId) {
  const ativa = await sessaoAtiva();
  if (ativa) return ativa;
  const agora = Date.now();
  const sessao = {
    id: novoId(),
    treino_id: treinoId,
    data: chaveData(new Date(agora)),
    hora_inicio: agora,
    hora_fim: null,
    status: 'em_andamento',
    pausado_em: null,
    tempo_pausado_ms: 0,
    descanso_inicio: null,
    descanso_duracao_ms: 0,
    serie_em_curso: null,
  };
  await put('sessoes', sessao);
  return sessao;
}

async function alterarSessao(id, fn) {
  return tx(['sessoes', 'series_registradas'], 'readwrite', async (t) => {
    const store = t.objectStore('sessoes');
    const sessao = await req(store.get(id));
    if (!sessao) throw new Error('Sessão não encontrada');
    await fn(sessao, Date.now(), t);
    store.put(sessao);
    return sessao;
  });
}

/**
 * Fecha o descanso em andamento e grava quanto ele durou de verdade na série
 * que o abriu (`descanso_seg`). O descanso vale até o toque que começa a
 * próxima série, passe ou não do alvo.
 */
async function fecharDescanso(t, sessao, agora) {
  if (!sessao.descanso_inicio) return;
  if (sessao.descanso_serie_id) {
    const series = t.objectStore('series_registradas');
    const serie = await req(series.get(sessao.descanso_serie_id));
    if (serie) series.put({ ...serie, descanso_seg: Math.round(Math.max(0, agora - sessao.descanso_inicio) / 1000) });
  }
  sessao.descanso_inicio = null;
  sessao.descanso_serie_id = null;
}

function encerrarPausa(sessao, agora) {
  if (sessao.pausado_em) {
    sessao.tempo_pausado_ms += agora - sessao.pausado_em;
    sessao.pausado_em = null;
  }
}

/** "Pausar e sair": congela o cronômetro do treino até retomar. */
export const pausarSessao = (id) => alterarSessao(id, async (s, agora, t) => {
  await fecharDescanso(t, s, agora);
  if (!s.pausado_em) s.pausado_em = agora;
  s.serie_em_curso = null;
});

export const retomarSessao = (id) => alterarSessao(id, encerrarPausa);

/**
 * Toque em "Iniciar série": termina o descanso (só se ainda for o mesmo que a
 * tela estava mostrando) e grava a duração real dele.
 */
export const encerrarDescanso = (id, inicioEsperado) => alterarSessao(id, async (s, agora, t) => {
  if (inicioEsperado == null || s.descanso_inicio === inicioEsperado) await fecharDescanso(t, s, agora);
});

/** Muda o alvo do descanso (só a referência do bipe; o descanso continua até você encerrar). */
export const ajustarDescanso = (id, deltaSeg) => alterarSessao(id, (s) => {
  if (!s.descanso_inicio) return;
  s.descanso_duracao_ms = Math.max(0, s.descanso_duracao_ms + deltaSeg * 1000);
});

/** Começa uma série do tipo tempo: fecha o descanso e guarda o instante de início. */
export const iniciarSerieTempo = (id, { exercicio_id, numero_serie, alvo_ms }) =>
  alterarSessao(id, async (s, agora, t) => {
    await fecharDescanso(t, s, agora);
    s.serie_em_curso = { exercicio_id, numero_serie, alvo_ms, inicio: agora };
  });

export const descartarSerieTempo = (id) => alterarSessao(id, (s) => { s.serie_em_curso = null; });

export const concluirSessao = (id) => alterarSessao(id, async (s, agora, t) => {
  await fecharDescanso(t, s, agora);
  encerrarPausa(s, agora);
  s.hora_fim = agora;
  s.status = 'concluida';
  s.serie_em_curso = null;
});

/**
 * Cancela o treino em andamento: apaga a sessão e todas as séries dela numa
 * única transação, sem deixar nada no histórico. Sessões concluídas não são
 * tocadas por aqui.
 */
export function cancelarSessao(id) {
  return tx(['sessoes', 'series_registradas'], 'readwrite', async (t) => {
    const sessoes = t.objectStore('sessoes');
    const sessao = await req(sessoes.get(id));
    if (!sessao) return false;
    if (sessao.status !== 'em_andamento') throw new Error('Só dá pra cancelar treino em andamento');

    const series = t.objectStore('series_registradas');
    const chaves = await req(series.index('sessao_id').getAllKeys(id));
    chaves.forEach((k) => series.delete(k));
    sessoes.delete(id);
    return true;
  });
}

export const obterSessao = (id) => get('sessoes', id);

// ---------- Exercícios do treino e séries ----------

/** Itens do treino na ordem, já com o exercício junto. Ignora exercícios apagados. */
export async function exerciciosDoTreino(treinoId) {
  const itens = await getAllPorIndice('treino_exercicios', 'treino_id', treinoId);
  itens.sort((a, b) => a.ordem - b.ordem);
  const exercicios = await Promise.all(itens.map((te) => get('exercicios', te.exercicio_id)));
  return itens
    .map((te, i) => ({ ...te, exercicio: exercicios[i] }))
    .filter((te) => te.exercicio);
}

export const seriesDaSessao = (sessaoId) =>
  getAllPorIndice('series_registradas', 'sessao_id', sessaoId);

/**
 * O que foi feito no exercício na última sessão concluída (fora a atual).
 * @returns {Promise<{data: string, series: object[]} | null>}
 */
export async function ultimaReferencia(exercicioId, sessaoAtualId) {
  const todas = await getAllPorIndice('series_registradas', 'exercicio_id', exercicioId);
  const porSessao = new Map();
  for (const serie of todas) {
    if (serie.sessao_id === sessaoAtualId) continue;
    const grupo = porSessao.get(serie.sessao_id) ?? { ultima: 0, series: [] };
    grupo.series.push(serie);
    grupo.ultima = Math.max(grupo.ultima, serie.registrada_em);
    porSessao.set(serie.sessao_id, grupo);
  }
  const ordenadas = [...porSessao.entries()].sort((a, b) => b[1].ultima - a[1].ultima);
  for (const [sessaoId, grupo] of ordenadas) {
    const sessao = await get('sessoes', sessaoId);
    if (sessao?.status === 'concluida') {
      return { data: sessao.data, series: grupo.series.sort((a, b) => a.numero_serie - b.numero_serie) };
    }
  }
  return null;
}

/**
 * Registra a série e, na mesma transação, começa o descanso a partir do
 * instante em que ela terminou (`registradaEm`). `descansoSeg` é o alvo do
 * descanso (quando apitar); 0 não inicia descanso (última série do treino).
 */
export function registrarSerie({
  sessaoId, exercicioId, numero, peso = null, reps = null, duracao = null,
  registradaEm = Date.now(), descansoSeg = 0,
}) {
  return tx(['sessoes', 'series_registradas'], 'readwrite', async (t) => {
    const sessoes = t.objectStore('sessoes');
    const sessao = await req(sessoes.get(sessaoId));
    if (sessao?.status !== 'em_andamento') throw new Error('Sessão não está em andamento');

    // Se o descanso anterior não foi encerrado por toque, ele vai até aqui.
    await fecharDescanso(t, sessao, registradaEm);

    const serie = {
      id: novoId(),
      sessao_id: sessaoId,
      exercicio_id: exercicioId,
      numero_serie: numero,
      peso, reps, duracao,
      registrada_em: registradaEm,
    };
    t.objectStore('series_registradas').put(serie);

    sessao.serie_em_curso = null;
    if (descansoSeg > 0) {
      sessao.descanso_inicio = registradaEm;
      sessao.descanso_duracao_ms = descansoSeg * 1000;
      sessao.descanso_serie_id = serie.id;
    }
    sessoes.put(sessao);
    return { sessao, serie };
  });
}

export function atualizarSerie(id, campos) {
  return tx('series_registradas', 'readwrite', async (t) => {
    const store = t.objectStore('series_registradas');
    const serie = await req(store.get(id));
    if (!serie) return null;
    Object.assign(serie, campos);
    store.put(serie);
    return serie;
  });
}

export const removerSerie = (id) => del('series_registradas', id);

export async function ultimaSessaoDoTreino(treinoId) {
  const sessoes = await getAllPorIndice('sessoes', 'treino_id', treinoId);
  return sessoes
    .filter((s) => s.status === 'concluida')
    .sort((a, b) => b.hora_inicio - a.hora_inicio)[0] ?? null;
}
