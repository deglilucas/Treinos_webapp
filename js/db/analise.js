// Cálculos do Progresso a partir das sessões concluídas.
// Carrega tudo de uma vez: mesmo anos de treino cabem folgado na memória.

import { getAll } from './db.js';

/** Sessões concluídas, séries delas e exercícios indexados por id. */
export async function carregarHistorico() {
  const [sessoes, series, exercicios] = await Promise.all([
    getAll('sessoes'), getAll('series_registradas'), getAll('exercicios'),
  ]);
  const concluidas = new Map(sessoes.filter((s) => s.status === 'concluida').map((s) => [s.id, s]));
  return {
    sessoes: concluidas,
    series: series.filter((s) => concluidas.has(s.sessao_id)),
    exercicios: new Map(exercicios.map((e) => [e.id, e])),
  };
}

/**
 * Exercícios com pelo menos uma série registrada, do feito mais recentemente ao
 * mais antigo. No mesmo dia, na ordem em que foram feitos.
 */
export function exerciciosComHistorico(h) {
  const ultimo = new Map(); // id → { data, primeira }
  for (const s of h.series) {
    const data = h.sessoes.get(s.sessao_id).data;
    const atual = ultimo.get(s.exercicio_id);
    if (!atual || atual.data < data) ultimo.set(s.exercicio_id, { data, primeira: s.registrada_em });
    else if (atual.data === data) atual.primeira = Math.min(atual.primeira, s.registrada_em);
  }
  return [...ultimo.entries()]
    .filter(([id]) => h.exercicios.has(id))
    .map(([id, u]) => ({ exercicio: h.exercicios.get(id), ultimaData: u.data, primeira: u.primeira }))
    .sort((a, b) => b.ultimaData.localeCompare(a.ultimaData) || a.primeira - b.primeira);
}

/** 1RM estimado (Epley). */
export const umRM = (peso, reps) => peso * (1 + reps / 30);

/**
 * Um ponto por sessão em que o exercício foi feito, em ordem cronológica.
 * @param {string} desde 'YYYY-MM-DD' (inclusive) ou null para tudo
 */
export function evolucaoExercicio(h, exercicioId, desde = null) {
  const porSessao = new Map();
  for (const s of h.series) {
    if (s.exercicio_id !== exercicioId) continue;
    const sessao = h.sessoes.get(s.sessao_id);
    if (desde && sessao.data < desde) continue;
    if (!porSessao.has(sessao.id)) porSessao.set(sessao.id, { sessao, series: [] });
    porSessao.get(sessao.id).series.push(s);
  }

  return [...porSessao.values()]
    .map(({ sessao, series }) => {
      series.sort((a, b) => a.numero_serie - b.numero_serie);
      const comPeso = series.filter((s) => s.peso != null && s.reps);
      const melhor = comPeso.reduce((m, s) => (!m || s.peso > m.peso || (s.peso === m.peso && s.reps > m.reps) ? s : m), null);
      return {
        sessao,
        data: sessao.data,
        series,
        melhor,
        carga: melhor?.peso ?? null,
        e1rm: comPeso.length ? Math.max(...comPeso.map((s) => umRM(s.peso, s.reps))) : null,
        volume: comPeso.reduce((t, s) => t + s.peso * s.reps, 0),
        maxReps: Math.max(0, ...series.map((s) => s.reps ?? 0)),
        totalReps: series.reduce((t, s) => t + (s.reps ?? 0), 0),
        maxDuracao: Math.max(0, ...series.map((s) => s.duracao ?? 0)),
        totalDuracao: series.reduce((t, s) => t + (s.duracao ?? 0), 0),
      };
    })
    .sort((a, b) => a.data.localeCompare(b.data) || a.sessao.hora_inicio - b.sessao.hora_inicio);
}

/**
 * Séries e volume por grupo muscular entre duas datas (inclusive).
 * Volume = peso × reps; séries de tempo e sem peso contam só como série.
 */
export function resumoPeriodo(h, ini, fim) {
  const grupos = new Map();
  const sessoes = new Set();
  let totalSeries = 0;
  let totalVolume = 0;
  for (const s of h.series) {
    const sessao = h.sessoes.get(s.sessao_id);
    if (sessao.data < ini || sessao.data > fim) continue;
    const ex = h.exercicios.get(s.exercicio_id);
    const grupo = ex?.grupo_muscular ?? 'Outros';
    const g = grupos.get(grupo) ?? { grupo, series: 0, volume: 0, exercicios: new Set() };
    const volume = s.peso != null && s.reps ? s.peso * s.reps : 0;
    g.series += 1;
    g.volume += volume;
    g.exercicios.add(s.exercicio_id);
    grupos.set(grupo, g);
    sessoes.add(sessao.id);
    totalSeries += 1;
    totalVolume += volume;
  }
  return { grupos: [...grupos.values()], totalSeries, totalVolume, sessoes: sessoes.size };
}
