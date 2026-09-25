// Operações de edição: montar treinos e manter a biblioteca de exercícios.

import { tx, req, get, getAll, getAllPorIndice, put, novoId } from './db.js';

const SIGLAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// ---------- Treinos ----------

export async function criarTreino() {
  const treinos = await getAll('treinos');
  const usadas = new Set(treinos.map((t) => t.sigla));
  const sigla = [...SIGLAS].find((s) => !usadas.has(s)) ?? String(treinos.length + 1);
  const treino = {
    id: novoId(),
    nome: 'Novo treino',
    sigla,
    ordem: treinos.reduce((m, t) => Math.max(m, t.ordem), -1) + 1,
  };
  await put('treinos', treino);
  return treino;
}

export async function atualizarTreino(id, campos) {
  const treino = await get('treinos', id);
  if (!treino) return null;
  Object.assign(treino, campos);
  await put('treinos', treino);
  return treino;
}

/** Sobe (-1) ou desce (+1) um treino na rotação A → B → C. */
export function moverTreino(id, delta) {
  return tx('treinos', 'readwrite', async (t) => {
    const store = t.objectStore('treinos');
    const lista = (await req(store.getAll())).sort((a, b) => a.ordem - b.ordem);
    const de = lista.findIndex((x) => x.id === id);
    const para = de + delta;
    if (de < 0 || para < 0 || para >= lista.length) return;
    [lista[de], lista[para]] = [lista[para], lista[de]];
    lista.forEach((x, ordem) => { if (x.ordem !== ordem) store.put({ ...x, ordem }); });
  });
}

/** Apaga o treino e a lista de exercícios dele. As sessões já feitas ficam no histórico. */
export function excluirTreino(id) {
  return tx(['treinos', 'treino_exercicios'], 'readwrite', async (t) => {
    const itens = t.objectStore('treino_exercicios');
    const chaves = await req(itens.index('treino_id').getAllKeys(id));
    chaves.forEach((k) => itens.delete(k));
    t.objectStore('treinos').delete(id);
  });
}

// ---------- Exercícios dentro do treino ----------

export async function adicionarAoTreino(treinoId, exercicio) {
  const itens = await getAllPorIndice('treino_exercicios', 'treino_id', treinoId);
  if (itens.some((i) => i.exercicio_id === exercicio.id)) return null; // sem repetidos
  const item = {
    id: novoId(),
    treino_id: treinoId,
    exercicio_id: exercicio.id,
    ordem: itens.reduce((m, i) => Math.max(m, i.ordem), -1) + 1,
    series: 3,
    descanso_padrao: exercicio.tipo_registro === 'tempo' ? 45 : 60,
  };
  await put('treino_exercicios', item);
  return item;
}

export async function atualizarItemTreino(id, campos) {
  const item = await get('treino_exercicios', id);
  if (!item) return null;
  Object.assign(item, campos);
  await put('treino_exercicios', item);
  return item;
}

/** Tira do treino e renumera a ordem dos que ficam. */
export function removerDoTreino(id) {
  return tx('treino_exercicios', 'readwrite', async (t) => {
    const store = t.objectStore('treino_exercicios');
    const item = await req(store.get(id));
    if (!item) return;
    store.delete(id);
    const resto = (await req(store.index('treino_id').getAll(item.treino_id)))
      .filter((i) => i.id !== id)
      .sort((a, b) => a.ordem - b.ordem);
    resto.forEach((i, ordem) => { if (i.ordem !== ordem) store.put({ ...i, ordem }); });
  });
}

/** Sobe (-1) ou desce (+1) um exercício na ordem do treino. */
export function moverNoTreino(id, delta) {
  return tx('treino_exercicios', 'readwrite', async (t) => {
    const store = t.objectStore('treino_exercicios');
    const item = await req(store.get(id));
    if (!item) return;
    const lista = (await req(store.index('treino_id').getAll(item.treino_id)))
      .sort((a, b) => a.ordem - b.ordem);
    const de = lista.findIndex((i) => i.id === id);
    const para = de + delta;
    if (para < 0 || para >= lista.length) return;
    [lista[de], lista[para]] = [lista[para], lista[de]];
    lista.forEach((i, ordem) => { if (i.ordem !== ordem) store.put({ ...i, ordem }); });
  });
}

// ---------- Biblioteca ----------

export async function listarExercicios() {
  const lista = await getAll('exercicios');
  return lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export async function temHistorico(exercicioId) {
  const series = await getAllPorIndice('series_registradas', 'exercicio_id', exercicioId);
  return series.length > 0;
}

export async function salvarExercicio(dados) {
  const ex = { ativo: true, apelidos: [], ...dados };
  if (!ex.id) {
    ex.id = `pessoal-${novoId()}`;
    ex.personalizado = true;
  }
  if (ex.tipo_registro !== 'tempo') delete ex.duracao_alvo;
  await put('exercicios', ex);
  return ex;
}

/**
 * Exclui o exercício e tira ele de todos os treinos. Se já tem séries
 * registradas, ele só é escondido (ativo = false) para não quebrar o histórico.
 * @returns {Promise<'excluido' | 'arquivado'>}
 */
export function excluirExercicio(id) {
  return tx(['exercicios', 'treino_exercicios', 'series_registradas'], 'readwrite', async (t) => {
    const itens = t.objectStore('treino_exercicios');
    const chaves = await req(itens.index('exercicio_id').getAllKeys(id));
    chaves.forEach((k) => itens.delete(k));

    const exercicios = t.objectStore('exercicios');
    const qtdSeries = await req(t.objectStore('series_registradas').index('exercicio_id').count(id));
    if (qtdSeries > 0) {
      const ex = await req(exercicios.get(id));
      exercicios.put({ ...ex, ativo: false });
      return 'arquivado';
    }
    exercicios.delete(id);
    return 'excluido';
  });
}

/** Busca sem acento e sem caixa, em nome e apelidos. Todas as palavras precisam aparecer. */
export const normalizar = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function combina(exercicio, termo) {
  const palavras = normalizar(termo).split(/\s+/).filter(Boolean);
  if (!palavras.length) return true;
  const alvo = normalizar([exercicio.nome, ...(exercicio.apelidos ?? [])].join(' '));
  return palavras.every((p) => alvo.includes(p));
}

// ---------- Treinos já feitos (correções no histórico) ----------

/** Apaga um treino do histórico com todas as séries dele. */
export function excluirSessao(id) {
  return tx(['sessoes', 'series_registradas'], 'readwrite', async (t) => {
    const series = t.objectStore('series_registradas');
    const chaves = await req(series.index('sessao_id').getAllKeys(id));
    chaves.forEach((k) => series.delete(k));
    t.objectStore('sessoes').delete(id);
  });
}

/** Apaga uma série de um treino feito e renumera as do mesmo exercício (1, 2, 3…). */
export function removerSerieDoHistorico(id) {
  return tx('series_registradas', 'readwrite', async (t) => {
    const store = t.objectStore('series_registradas');
    const serie = await req(store.get(id));
    if (!serie) return;
    store.delete(id);
    const resto = (await req(store.index('sessao_id').getAll(serie.sessao_id)))
      .filter((s) => s.exercicio_id === serie.exercicio_id && s.id !== id)
      .sort((a, b) => a.numero_serie - b.numero_serie);
    resto.forEach((s, i) => { if (s.numero_serie !== i + 1) store.put({ ...s, numero_serie: i + 1 }); });
  });
}

/** Série esquecida: entra depois das outras do mesmo exercício, sem mexer em descanso. */
export async function adicionarSerieManual(sessaoId, exercicioId, valores) {
  const doExercicio = (await getAllPorIndice('series_registradas', 'sessao_id', sessaoId))
    .filter((s) => s.exercicio_id === exercicioId);
  const ultima = doExercicio.sort((a, b) => a.numero_serie - b.numero_serie).at(-1);
  const sessao = await get('sessoes', sessaoId);
  const serie = {
    id: novoId(),
    sessao_id: sessaoId,
    exercicio_id: exercicioId,
    numero_serie: (ultima?.numero_serie ?? 0) + 1,
    peso: valores.peso ?? null,
    reps: valores.reps ?? null,
    duracao: valores.duracao ?? null,
    registrada_em: (ultima?.registrada_em ?? sessao.hora_inicio) + 1,
  };
  await put('series_registradas', serie);
  return serie;
}

/** Corrige a duração (ex.: esqueceu de concluir e o cronômetro ficou rodando). */
export async function ajustarDuracaoSessao(id, duracaoMs) {
  const sessao = await get('sessoes', id);
  if (!sessao) return null;
  sessao.hora_fim = sessao.hora_inicio + (sessao.tempo_pausado_ms || 0) + duracaoMs;
  await put('sessoes', sessao);
  return sessao;
}
