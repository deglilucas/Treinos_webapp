// Treino esquecido aberto: ao abrir o app (ou voltar pra ele), se o treino
// está parado há muito tempo, pergunta o que fazer em vez de deixar o
// cronômetro correndo para sempre.

import {
  sessaoAtiva, ultimaAtividade, concluirSessaoEsquecida, cancelarSessao, seriesDaSessao,
  nomeCompletoTreino,
} from '../db/repo.js';
import { get, getConfig, setConfig } from '../db/db.js';
import { rotuloDia } from './datas.js';
import { duracaoSessao, formatarDuracao } from './timer.js';
import { abrirSheet } from '../ui/sheet.js';
import { toast } from '../ui/dom.js';
import { ir } from '../router.js';

const PARADO_MS = 3 * 3600 * 1000;    // treino rodando sem nenhuma série nova
const PAUSADO_MS = 12 * 3600 * 1000;  // "pausar e sair" sem voltar
let verificando = false;

const hora = (ms) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export async function verificarTreinoAberto() {
  if (verificando) return;
  verificando = true;
  try {
    const sessao = await sessaoAtiva();
    if (!sessao) return;
    const ultima = await ultimaAtividade(sessao);
    const desde = Math.max(ultima, sessao.pausado_em ?? 0);
    const parado = Date.now() - desde;
    if (parado < (sessao.pausado_em ? PAUSADO_MS : PARADO_MS)) return;

    // "Continuar treinando" vale até ficar parado de novo pelo mesmo tempo.
    const adiado = await getConfig('treino_aberto_adiado');
    if (adiado?.sessao === sessao.id && Date.now() - adiado.em < PARADO_MS) return;

    const [treino, series] = await Promise.all([get('treinos', sessao.treino_id), seriesDaSessao(sessao.id)]);
    const n = series.length;
    const escolha = await abrirSheet({
      titulo: 'Treino ainda aberto',
      texto: `${nomeCompletoTreino(treino)} começou ${rotuloDia(sessao.data).toLowerCase()} às ${hora(sessao.hora_inicio)} `
        + `e está parado há ${formatarDuracao(parado)}.`
        + (n ? ` Ao concluir, ele termina na última série, às ${hora(ultima)}.` : ' Nenhuma série foi registrada.'),
      acoes: [
        ...(n ? [{ id: 'concluir', rotulo: `Concluir com ${n === 1 ? '1 série' : `${n} séries`}`, primario: true }] : []),
        { id: 'descartar', rotulo: 'Descartar treino', perigo: true },
      ],
      rotuloFechar: 'Continuar treinando',
    });

    if (escolha === 'concluir') {
      const final = await concluirSessaoEsquecida(sessao.id);
      ir('inicio');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      toast(`Treino concluído · ${formatarDuracao(duracaoSessao(final))}`);
    } else if (escolha === 'descartar') {
      const ok = !n || await abrirSheet({
        titulo: 'Descartar treino?',
        texto: `As ${n === 1 ? '1 série registrada' : `${n} séries registradas`} serão apagadas e esse treino não vai aparecer no histórico.`,
        acoes: [{ id: 'sim', rotulo: 'Descartar treino', perigo: true }],
      });
      if (!ok) return;
      await cancelarSessao(sessao.id);
      ir('inicio');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      toast('Treino descartado');
    } else {
      await setConfig('treino_aberto_adiado', { sessao: sessao.id, em: Date.now() });
    }
  } finally {
    verificando = false;
  }
}
