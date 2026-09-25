// Notificação do treino em andamento (carregado pelo sw.js com importScripts).
//
// Com o app em segundo plano, mostra a fase atual com um botão para avançar:
//   descanso  → "Iniciar série" (fecha o descanso e grava a duração real;
//               se a próxima série for de tempo, já começa ela)
//   série     → "Concluir série" (registra e abre o descanso; na última do
//               treino não há descanso, a notificação pede para concluir)
// O bipe do alvo é agendado aqui: o SW fica acordado até o alvo, dentro do
// limite de alguns minutos que o navegador permite.
//
// As regras espelham js/screens/sessao.js e js/db/repo.js.

const TAG_TREINO = 'treino';
const ESPERA_MAXIMA_MS = 4.5 * 60 * 1000; // o Chrome encerra eventos que passam de ~5 min
const ICONE = './icons/icon-192.png';
const BADGE = './icons/badge-96.png';

// ---------- IndexedDB (sem versão: usa o banco que o app já criou) ----------

function abrirBanco() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('treinos');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onupgradeneeded = () => r.transaction.abort(); // banco ainda não existe: nada a fazer
  });
}

const pedido = (r) => new Promise((resolve, reject) => {
  r.onsuccess = () => resolve(r.result);
  r.onerror = () => reject(r.error);
});

function transacao(db, stores, modo, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, modo);
    let saida;
    t.oncomplete = () => resolve(saida);
    t.onabort = () => reject(t.error);
    Promise.resolve(fn(t)).then((v) => { saida = v; }, (e) => { try { t.abort(); } catch {} reject(e); });
  });
}

const novoIdSW = () => (self.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2));

// ---------- Estado do treino ----------

async function carregarTreino(db) {
  return transacao(db, ['sessoes', 'treinos', 'treino_exercicios', 'exercicios', 'series_registradas'], 'readonly', async (t) => {
    const ativas = await pedido(t.objectStore('sessoes').index('status').getAll('em_andamento'));
    const sessao = ativas.sort((a, b) => b.hora_inicio - a.hora_inicio)[0];
    if (!sessao || sessao.pausado_em) return null;
    const treino = await pedido(t.objectStore('treinos').get(sessao.treino_id));
    const itens = (await pedido(t.objectStore('treino_exercicios').index('treino_id').getAll(sessao.treino_id)))
      .sort((a, b) => a.ordem - b.ordem);
    for (const item of itens) item.exercicio = await pedido(t.objectStore('exercicios').get(item.exercicio_id));
    const series = await pedido(t.objectStore('series_registradas').index('sessao_id').getAll(sessao.id));
    return { sessao, treino, itens: itens.filter((i) => i.exercicio), series };
  });
}

/** Séries planejadas (e as extras do "+ Série") ainda não feitas, na ordem do treino. */
function pendentes({ sessao, itens, series }) {
  const lista = [];
  for (const item of itens) {
    const feitas = new Set(series.filter((s) => s.exercicio_id === item.exercicio_id).map((s) => s.numero_serie));
    const total = item.series + (sessao.extras?.[item.id] ?? 0);
    for (let n = 1; n <= total; n++) if (!feitas.has(n)) lista.push({ item, numero: n });
  }
  return lista;
}

const lerNumero = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/**
 * Carga e reps sugeridas, campo a campo: o que está digitado na tela (rascunho
 * salvo na sessão), senão a série anterior de hoje, senão a da última vez.
 */
async function sugestao(db, estado, item, numero) {
  const base = await sugestaoBase(db, estado, item, numero);
  const rascunho = estado.sessao.rascunhos?.[`${item.id}:${numero}`] ?? {};
  const reps = parseInt(rascunho.reps, 10);
  return {
    peso: String(rascunho.peso ?? '').trim() ? lerNumero(rascunho.peso) : base.peso,
    reps: reps > 0 ? reps : base.reps,
  };
}

async function sugestaoBase(db, estado, item, numero) {
  const hoje = estado.series
    .filter((s) => s.exercicio_id === item.exercicio_id && s.numero_serie < numero)
    .sort((a, b) => a.numero_serie - b.numero_serie).at(-1);
  if (hoje) return { peso: hoje.peso, reps: hoje.reps };
  const ref = await transacao(db, ['series_registradas', 'sessoes'], 'readonly', async (t) => {
    const todas = (await pedido(t.objectStore('series_registradas').index('exercicio_id').getAll(item.exercicio_id)))
      .filter((s) => s.sessao_id !== estado.sessao.id)
      .sort((a, b) => b.registrada_em - a.registrada_em);
    for (const s of todas) {
      const sessao = await pedido(t.objectStore('sessoes').get(s.sessao_id));
      if (sessao?.status === 'concluida') return todas.filter((x) => x.sessao_id === s.sessao_id);
    }
    return [];
  });
  const base = ref.find((s) => s.numero_serie === numero) ?? ref.sort((a, b) => a.numero_serie - b.numero_serie).at(-1);
  return base ? { peso: base.peso, reps: base.reps } : { peso: null, reps: null };
}

const alvoSegDe = (item) => item.duracao_alvo ?? item.exercicio.duracao_alvo ?? 60;

function relogio(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  return `${m}:${String(total % 60).padStart(2, '0')}`;
}
const carga = (sug) => (sug.reps ? `${sug.peso != null ? `${String(sug.peso).replace('.', ',')} kg × ` : ''}${sug.reps}` : '');

/**
 * Fase atual e o que a notificação mostra.
 * @returns {Promise<{fase: string, titulo: string, corpo: string, acoes: object[], alvoEm: number|null, chave: string}>}
 */
async function descreverFase(db, estado) {
  const { sessao } = estado;
  const fila = pendentes(estado);

  if (sessao.serie_em_curso) {
    const c = sessao.serie_em_curso;
    const item = estado.itens.find((i) => i.exercicio_id === c.exercicio_id);
    return {
      fase: 'tempo',
      titulo: `${item?.exercicio.nome ?? 'Série'} · série ${c.numero_serie}`,
      corpo: `Em andamento · alvo ${relogio(c.alvo_ms)}`,
      acoes: [{ action: 'concluir', title: 'Concluir série' }],
      alvoEm: c.inicio + c.alvo_ms,
      chave: `tempo:${c.inicio}`,
      alerta: 'Alvo atingido',
    };
  }

  if (sessao.descanso_inicio) {
    const proxima = fila[0];
    const sug = proxima && proxima.item.exercicio.tipo_registro !== 'tempo'
      ? carga(await sugestao(db, estado, proxima.item, proxima.numero)) : '';
    return {
      fase: 'descanso',
      titulo: `Descanso · alvo ${relogio(sessao.descanso_duracao_ms)}`,
      corpo: proxima ? `Próxima: ${proxima.item.exercicio.nome} · série ${proxima.numero}${sug ? ` (${sug})` : ''}` : 'Descansando',
      acoes: [{ action: 'iniciar', title: 'Iniciar série' }],
      alvoEm: sessao.descanso_inicio + sessao.descanso_duracao_ms,
      chave: `descanso:${sessao.descanso_inicio}`,
      alerta: 'Descanso completo',
    };
  }

  const proxima = fila[0];
  if (!proxima) {
    return {
      fase: 'fim', titulo: 'Treino completo', corpo: 'Toque para abrir e concluir o treino.',
      acoes: [], alvoEm: null, chave: 'fim',
    };
  }
  if (proxima.item.exercicio.tipo_registro === 'tempo') {
    return {
      fase: 'serie',
      titulo: `${proxima.item.exercicio.nome} · série ${proxima.numero}`,
      corpo: `Alvo ${relogio(alvoSegDe(proxima.item) * 1000)}`,
      acoes: [{ action: 'iniciar', title: 'Iniciar série' }],
      alvoEm: null, chave: `serie:${proxima.item.id}:${proxima.numero}`,
    };
  }
  const sug = await sugestao(db, estado, proxima.item, proxima.numero);
  return {
    fase: 'serie',
    titulo: `${proxima.item.exercicio.nome} · série ${proxima.numero}`,
    // Sem carga e reps conhecidas, o botão continua: a série fica "a preencher" no app.
    corpo: sug.reps
      ? `${carga(sug)} · toque em Concluir quando terminar`
      : 'Toque em Concluir quando terminar. Carga e reps você preenche depois no app.',
    acoes: [{ action: 'concluir', title: 'Concluir série' }],
    alvoEm: null, chave: `serie:${proxima.item.id}:${proxima.numero}`,
  };
}

async function mostrarNotificacao(desc, estado, { alerta = false } = {}) {
  await self.registration.showNotification(alerta ? `${desc.alerta} · ${desc.titulo}` : desc.titulo, {
    body: desc.corpo,
    tag: TAG_TREINO,
    renotify: alerta,
    silent: !alerta,
    vibrate: alerta ? [200, 100, 200] : undefined,
    requireInteraction: true,
    icon: ICONE,
    badge: BADGE,
    actions: desc.acoes,
    data: { sessaoId: estado.sessao.id, chave: desc.chave },
  });
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Mostra a fase atual e, se houver alvo por perto, espera por ele e apita. */
async function atualizarNotificacao() {
  const db = await abrirBanco().catch(() => null);
  if (!db) return;
  try {
    const estado = await carregarTreino(db);
    if (!estado) return fecharNotificacoes();
    const desc = await descreverFase(db, estado);
    await mostrarNotificacao(desc, estado);

    const falta = desc.alvoEm ? desc.alvoEm - Date.now() : -1;
    if (falta <= 0 || falta > ESPERA_MAXIMA_MS) return;
    await dormir(falta);
    // Só apita se ainda estiver na mesma fase (você pode ter avançado antes).
    const agora = await carregarTreino(db);
    if (!agora) return;
    const descAgora = await descreverFase(db, agora);
    if (descAgora.chave === desc.chave && !(await appVisivel())) await mostrarNotificacao(descAgora, agora, { alerta: true });
  } finally {
    db.close();
  }
}

async function fecharNotificacoes() {
  const abertas = await self.registration.getNotifications({ tag: TAG_TREINO });
  abertas.forEach((n) => n.close());
}

async function appVisivel() {
  const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  return janelas.some((c) => c.visibilityState === 'visible');
}

async function avisarApp() {
  const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  janelas.forEach((c) => c.postMessage({ tipo: 'sessao-alterada' }));
}

// ---------- Botões da notificação ----------

async function fecharDescansoSW(t, sessao, agora) {
  if (!sessao.descanso_inicio) return;
  if (sessao.descanso_serie_id) {
    const store = t.objectStore('series_registradas');
    const serie = await pedido(store.get(sessao.descanso_serie_id));
    if (serie) store.put({ ...serie, descanso_seg: Math.round(Math.max(0, agora - sessao.descanso_inicio) / 1000) });
  }
  sessao.descanso_inicio = null;
  sessao.descanso_serie_id = null;
}

async function executarAcao(acao) {
  const db = await abrirBanco();
  try {
    const estado = await carregarTreino(db);
    if (!estado) return;
    const agora = Date.now();
    const fila = pendentes(estado);

    // Valores sugeridos são lidos antes de abrir a transação de escrita.
    let registrar = null;
    if (acao === 'concluir') {
      const c = estado.sessao.serie_em_curso;
      if (c) {
        registrar = { exercicio_id: c.exercicio_id, numero: c.numero_serie, peso: null, reps: null, duracao: Math.max(1, Math.round((agora - c.inicio) / 1000)) };
      } else if (fila[0] && fila[0].item.exercicio.tipo_registro !== 'tempo') {
        const sug = await sugestao(db, estado, fila[0].item, fila[0].numero);
        registrar = {
          exercicio_id: fila[0].item.exercicio_id, numero: fila[0].numero,
          peso: sug.peso, reps: sug.reps, duracao: null,
          aPreencher: !sug.reps, // registrada sem reps: o app pede para completar
        };
      }
      if (!registrar) return;
    }

    await transacao(db, ['sessoes', 'series_registradas'], 'readwrite', async (t) => {
      const sessoes = t.objectStore('sessoes');
      const sessao = await pedido(sessoes.get(estado.sessao.id));
      if (sessao?.status !== 'em_andamento') return;

      if (acao === 'iniciar') {
        await fecharDescansoSW(t, sessao, agora);
        const proxima = fila[0];
        if (proxima?.item.exercicio.tipo_registro === 'tempo' && !sessao.serie_em_curso) {
          sessao.serie_em_curso = {
            exercicio_id: proxima.item.exercicio_id, numero_serie: proxima.numero,
            alvo_ms: alvoSegDe(proxima.item) * 1000, inicio: agora,
          };
        }
      } else if (registrar) {
        await fecharDescansoSW(t, sessao, agora);
        const item = estado.itens.find((i) => i.exercicio_id === registrar.exercicio_id);
        if (sessao.rascunhos && item) delete sessao.rascunhos[`${item.id}:${registrar.numero}`];
        const serie = {
          id: novoIdSW(), sessao_id: sessao.id, exercicio_id: registrar.exercicio_id,
          numero_serie: registrar.numero, peso: registrar.peso, reps: registrar.reps,
          duracao: registrar.duracao, registrada_em: agora,
          ...(registrar.aPreencher ? { a_preencher: true } : {}),
        };
        t.objectStore('series_registradas').put(serie);
        sessao.serie_em_curso = null;
        // Toda série abre descanso, menos a última do treino.
        const restantes = fila.filter((p) => !(p.item.exercicio_id === registrar.exercicio_id && p.numero === registrar.numero));
        if (restantes.length && item?.descanso_padrao > 0) {
          sessao.descanso_inicio = agora;
          sessao.descanso_duracao_ms = item.descanso_padrao * 1000;
          sessao.descanso_serie_id = serie.id;
        }
      }
      sessoes.put(sessao);
    });
    await avisarApp();
  } finally {
    db.close();
  }
}

async function abrirApp(sessaoId) {
  const url = new URL(`./#/treinar/sessao/${sessaoId ?? ''}`, self.registration.scope).href;
  const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const janela = janelas[0];
  if (janela) {
    janela.postMessage({ tipo: 'abrir', hash: `#/treinar/sessao/${sessaoId ?? ''}` });
    return janela.focus();
  }
  return self.clients.openWindow(url);
}

self.addEventListener('notificationclick', (event) => {
  const { action, notification } = event;
  if (!action) {
    notification.close();
    event.waitUntil(abrirApp(notification.data?.sessaoId));
    return;
  }
  event.waitUntil(executarAcao(action).then(atualizarNotificacao).catch(() => {}));
});

self.addEventListener('message', (event) => {
  const tipo = event.data?.tipo;
  if (tipo === 'segundo-plano') event.waitUntil(atualizarNotificacao().catch(() => {}));
  else if (tipo === 'primeiro-plano') event.waitUntil(fecharNotificacoes());
});
