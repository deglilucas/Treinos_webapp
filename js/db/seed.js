// Carga inicial: biblioteca de exercícios (biblioteca.js) + treinos A/B/C.
// O seed só adiciona o que falta: nunca sobrescreve algo que você editou.

import { tx, req, getConfig, novoId } from './db.js';
import { BIBLIOTECA } from './biblioteca.js';

export const GRUPOS = [
  'Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Antebraço',
  'Quadríceps', 'Posterior', 'Glúteos', 'Adutores', 'Panturrilha',
  'Abdômen', 'Cardio', 'Funcional', 'Alongamento',
];

export const EQUIPAMENTOS = [
  'Barra', 'Barra W', 'Halter', 'Máquina', 'Polia', 'Smith',
  'Peso corporal', 'Anilha', 'Kettlebell', 'Elástico', 'TRX', 'Bola',
  'Aparelho aeróbico', 'Outro',
];

// Suba ao acrescentar exercícios em biblioteca.js.
const SEED_VERSAO = 2;

// Treinos iniciais — dá pra editar ou apagar tudo em Ajustes.
// [exercicio_id, series, descanso_s]
const TREINOS_INICIAIS = [
  {
    sigla: 'A', nome: 'Peito e Tríceps', exercicios: [
      ['supino-reto-barra', 4, 90], ['supino-inclinado-halter', 3, 90], ['crucifixo-maquina', 3, 60],
      ['triceps-corda', 3, 60], ['triceps-testa', 3, 60], ['prancha', 3, 45],
    ],
  },
  {
    sigla: 'B', nome: 'Costas e Bíceps', exercicios: [
      ['puxada-frontal', 4, 90], ['remada-curvada', 3, 90], ['remada-baixa', 3, 60],
      ['rosca-direta', 3, 60], ['rosca-martelo', 3, 60],
    ],
  },
  {
    sigla: 'C', nome: 'Pernas e Ombros', exercicios: [
      ['agachamento-livre', 4, 120], ['leg-press', 3, 90], ['cadeira-extensora', 3, 60],
      ['mesa-flexora', 3, 60], ['desenvolvimento-halter', 3, 90], ['elevacao-lateral', 3, 60],
      ['panturrilha-em-pe', 4, 45],
    ],
  },
];

function montarExercicio([id, nome, apelidos, grupo, equipamento, nomeEn, tipo = 'peso_reps', duracao]) {
  const ex = {
    id, nome, apelidos,
    grupo_muscular: grupo,
    equipamento,
    tipo_registro: tipo,
    ativo: true,
    nome_en: nomeEn,
  };
  if (tipo === 'tempo') ex.duracao_alvo = duracao;
  return ex;
}

export async function garantirSeed() {
  const versao = await getConfig('seed_versao', 0);
  if (versao >= SEED_VERSAO) return;

  await tx(['exercicios', 'treinos', 'treino_exercicios', 'config'], 'readwrite', async (t) => {
    const exStore = t.objectStore('exercicios');
    const existentes = new Set(await req(exStore.getAllKeys()));
    for (const linha of BIBLIOTECA) {
      if (!existentes.has(linha[0])) exStore.put(montarExercicio(linha));
    }

    // Treinos iniciais só na primeira instalação.
    if (versao === 0) {
      const trStore = t.objectStore('treinos');
      const teStore = t.objectStore('treino_exercicios');
      const qtdTreinos = await req(trStore.count());
      if (qtdTreinos === 0) {
        TREINOS_INICIAIS.forEach((treino, i) => {
          const treinoId = novoId();
          trStore.put({ id: treinoId, nome: treino.nome, sigla: treino.sigla, ordem: i });
          treino.exercicios.forEach(([exercicio_id, series, descanso_padrao], ordem) => {
            teStore.put({ id: novoId(), treino_id: treinoId, exercicio_id, ordem, series, descanso_padrao });
          });
        });
      }
    }

    // v2: apelido errado no pular corda ("corda naval" é outro exercício).
    if (versao > 0 && versao < 2) {
      const corda = await req(exStore.get('pular-corda'));
      if (corda?.apelidos?.includes('corda naval')) {
        exStore.put({ ...corda, apelidos: corda.apelidos.map((a) => (a === 'corda naval' ? 'corda' : a)) });
      }
    }

    t.objectStore('config').put({ chave: 'seed_versao', valor: SEED_VERSAO });
  });
}
