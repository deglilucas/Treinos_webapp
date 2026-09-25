// Notificação do treino com o app em segundo plano (quem desenha e trata os
// botões é o service worker, em sw-treino.js). Aqui ficam a permissão e a
// conversa com o SW: avisar quando o app some ou volta, e redesenhar a tela
// se um botão da notificação mudou o treino.

import { getConfig, setConfig } from '../db/db.js';

let ativado = false;       // cache da preferência, lido no boot (o evento de saída não pode esperar o banco)
let mudouLaFora = false;   // um botão da notificação mexeu no treino enquanto o app estava escondido

export const suportado = () => 'Notification' in window && 'serviceWorker' in navigator;
export const permissao = () => (suportado() ? Notification.permission : 'sem-suporte');
export const estaAtivado = () => ativado && permissao() === 'granted';

async function enviar(mensagem) {
  const reg = await navigator.serviceWorker?.ready;
  reg?.active?.postMessage(mensagem);
}

/** Pede permissão (precisa vir de um toque) e liga. Retorna a permissão final. */
export async function ativar() {
  if (!suportado()) return 'sem-suporte';
  const resultado = await Notification.requestPermission();
  ativado = resultado === 'granted';
  await setConfig('notificacoes', ativado);
  return resultado;
}

export async function desativar() {
  ativado = false;
  await setConfig('notificacoes', false);
  enviar({ tipo: 'primeiro-plano' }); // fecha a que estiver aberta
}

/** Oferece a notificação uma vez, na primeira vez que um treino é aberto. */
export async function deveOferecer() {
  return suportado() && permissao() === 'default' && !(await getConfig('notificacoes_perguntado', false));
}
export const marcarOferecido = () => setConfig('notificacoes_perguntado', true);

/** @param {() => void} redesenhar chamado quando o treino mudou pela notificação */
export async function iniciarNotificacoes(redesenhar) {
  if (!suportado()) return;
  ativado = await getConfig('notificacoes', false);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (estaAtivado()) enviar({ tipo: 'segundo-plano' });
    } else {
      enviar({ tipo: 'primeiro-plano' });
      if (mudouLaFora) {
        mudouLaFora = false;
        redesenhar();
      }
    }
  });

  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.tipo === 'sessao-alterada') {
      if (document.visibilityState === 'visible') redesenhar();
      else mudouLaFora = true;
    } else if (e.data?.tipo === 'abrir' && e.data.hash) {
      if (location.hash !== e.data.hash) location.hash = e.data.hash;
      else redesenhar();
    }
  });
}
