// Esquema do IndexedDB.
//
// Datas de calendário ficam como string local 'YYYY-MM-DD' (facilita busca por
// intervalo e não sofre com fuso). Instantes (início, fim, pausa, descanso)
// ficam como epoch em ms — é daí que todo timer é calculado.

export const DB_NOME = 'treinos';
export const DB_VERSAO = 1;

/**
 * @typedef {'peso_reps' | 'tempo'} TipoRegistro
 *
 * @typedef Exercicio
 * @property {string} id
 * @property {string} nome
 * @property {string[]} apelidos
 * @property {string} grupo_muscular
 * @property {string} equipamento
 * @property {TipoRegistro} tipo_registro
 * @property {boolean} ativo
 * @property {number} [duracao_alvo]    segundos, só para tipo 'tempo'
 * @property {boolean} [personalizado]  criado pelo usuário
 * @property {string} [nome_en]         nome em inglês (referência)
 * @property {string} [imagem_id]       imagem escolhida no catálogo ('' = sem imagem); sem o campo, usa a de imagens.js
 * @property {string} [catalogo_id]     id no free-exercise-db, se veio do catálogo online
 *
 * @typedef Treino
 * @property {string} id
 * @property {string} nome     ex.: 'Costas e Bíceps'
 * @property {string} sigla    ex.: 'B'
 * @property {number} ordem    define a rotação A → B → C
 *
 * @typedef TreinoExercicio
 * @property {string} id
 * @property {string} treino_id
 * @property {string} exercicio_id
 * @property {number} ordem
 * @property {number} series
 * @property {number} descanso_padrao   segundos
 * @property {number} [duracao_alvo]    sobrescreve a do exercício
 *
 * @typedef Sessao
 * @property {string} id
 * @property {string} treino_id
 * @property {string} data              'YYYY-MM-DD'
 * @property {number} hora_inicio       epoch ms
 * @property {number|null} hora_fim     epoch ms
 * @property {'em_andamento' | 'concluida'} status
 * @property {number|null} pausado_em   epoch ms quando "pausar e sair"
 * @property {number} tempo_pausado_ms  soma das pausas já encerradas
 * @property {number|null} descanso_inicio      epoch ms; o descanso só termina por toque
 * @property {number} descanso_duracao_ms       alvo do descanso (quando apitar)
 * @property {string|null} descanso_serie_id    série que abriu o descanso (recebe o descanso_seg)
 * @property {Record<string, {peso: string, reps: string}>} [rascunhos]  valores digitados e não registrados, por 'itemId:numero'
 * @property {{exercicio_id: string, numero_serie: number, alvo_ms: number, inicio: number} | null} serie_em_curso
 *           série de tempo rodando; só termina por toque, o alvo é quando apitar
 *
 * @typedef SerieRegistrada
 * @property {string} id
 * @property {string} sessao_id
 * @property {string} exercicio_id
 * @property {number} numero_serie
 * @property {number|null} peso         kg
 * @property {number|null} reps
 * @property {number|null} duracao      segundos
 * @property {number} registrada_em     epoch ms
 * @property {number} [descanso_seg]    descanso real depois desta série, até o toque que começou a próxima
 *
 * @typedef MedidaCorporal
 * @property {string} id
 * @property {string} data              'YYYY-MM-DD'
 * @property {number|null} peso_corporal
 * @property {Record<string, number>} medidas  ex.: { cintura: 82, braco_d: 36 }
 */

/** Chamado dentro de onupgradeneeded. Cada bloco leva de uma versão para a próxima. */
export function migrar(db, versaoAntiga) {
  if (versaoAntiga < 1) {
    const exercicios = db.createObjectStore('exercicios', { keyPath: 'id' });
    exercicios.createIndex('grupo_muscular', 'grupo_muscular');
    exercicios.createIndex('equipamento', 'equipamento');

    const treinos = db.createObjectStore('treinos', { keyPath: 'id' });
    treinos.createIndex('ordem', 'ordem');

    const treinoExercicios = db.createObjectStore('treino_exercicios', { keyPath: 'id' });
    treinoExercicios.createIndex('treino_id', 'treino_id');
    treinoExercicios.createIndex('exercicio_id', 'exercicio_id');

    const sessoes = db.createObjectStore('sessoes', { keyPath: 'id' });
    sessoes.createIndex('data', 'data');
    sessoes.createIndex('status', 'status');
    sessoes.createIndex('treino_id', 'treino_id');

    const series = db.createObjectStore('series_registradas', { keyPath: 'id' });
    series.createIndex('sessao_id', 'sessao_id');
    series.createIndex('exercicio_id', 'exercicio_id');

    const medidas = db.createObjectStore('medidas_corporais', { keyPath: 'id' });
    medidas.createIndex('data', 'data');

    // Preferências e controle interno (versão do seed etc.)
    db.createObjectStore('config', { keyPath: 'chave' });
  }

  // if (versaoAntiga < 2) { ... próxima migração ... }
}
