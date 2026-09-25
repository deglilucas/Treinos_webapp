// Timers baseados em relógio de parede.
//
// Nada aqui "conta" tempo. O que fica salvo é o instante em que algo começou
// (epoch ms, persistido na sessão) e o tempo mostrado é sempre calculado como
// Date.now() - inicio. Assim, se a tela bloquear, o navegador congelar a aba
// ou o app for morto, o valor volta correto na próxima renderização.
// O setInterval do ticker serve apenas para redesenhar a tela.

/** Duração efetiva da sessão, descontando pausas. */
export function duracaoSessao(sessao, agora = Date.now()) {
  if (!sessao?.hora_inicio) return 0;
  const fim = sessao.hora_fim ?? sessao.pausado_em ?? agora;
  return Math.max(0, fim - sessao.hora_inicio - (sessao.tempo_pausado_ms || 0));
}

/** Milissegundos que faltam do descanso atual (0 se não há descanso rodando). */
export function descansoRestante(sessao, agora = Date.now()) {
  if (!sessao?.descanso_inicio) return 0;
  return Math.max(0, sessao.descanso_inicio + sessao.descanso_duracao_ms - agora);
}

/** Tempo decorrido desde um instante qualquer (ex.: série de tempo em andamento). */
export const decorrido = (inicio, agora = Date.now()) => Math.max(0, agora - inicio);

/** 75_000 → '1:15' · 3_725_000 → '1:02:05' */
export function formatarCronometro(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** 3_120_000 → '52 min' · 4_500_000 → '1h 15min' */
export function formatarDuracao(ms) {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto ? `${h}h ${resto}min` : `${h}h`;
}

/**
 * Chama `fn(agora)` periodicamente e também sempre que o app volta ao primeiro
 * plano (desbloqueio de tela, troca de app), para a tela nunca mostrar valor velho.
 * Retorna a função que para o ticker.
 */
export function criarTicker(fn, intervaloMs = 250) {
  const tick = () => fn(Date.now());
  const aoVoltar = () => { if (document.visibilityState === 'visible') tick(); };

  tick();
  const id = setInterval(tick, intervaloMs);
  document.addEventListener('visibilitychange', aoVoltar);
  window.addEventListener('pageshow', aoVoltar);
  window.addEventListener('focus', tick);

  return () => {
    clearInterval(id);
    document.removeEventListener('visibilitychange', aoVoltar);
    window.removeEventListener('pageshow', aoVoltar);
    window.removeEventListener('focus', tick);
  };
}
