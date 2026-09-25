// Biblioteca pré-carregada de exercícios + treinos A/B/C iniciais.
// O seed só adiciona o que falta: nunca sobrescreve algo que você editou.

import { tx, req, getConfig, novoId } from './db.js';

export const GRUPOS = [
  'Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Antebraço',
  'Quadríceps', 'Posterior', 'Glúteos', 'Adutores', 'Panturrilha',
  'Abdômen', 'Cardio',
];

export const EQUIPAMENTOS = [
  'Barra', 'Barra W', 'Halter', 'Máquina', 'Polia', 'Smith',
  'Peso corporal', 'Kettlebell', 'Elástico', 'Aparelho aeróbico',
];

const SEED_VERSAO = 1;

// [id, nome, apelidos, grupo, equipamento, nome_en, tipo?, duracao_alvo?]
const BIBLIOTECA = [
  // Peito
  ['supino-reto-barra', 'Supino reto com barra', ['supino', 'supino reto', 'bench'], 'Peito', 'Barra', 'barbell bench press'],
  ['supino-inclinado-barra', 'Supino inclinado com barra', ['supino inclinado'], 'Peito', 'Barra', 'barbell incline bench press'],
  ['supino-declinado-barra', 'Supino declinado com barra', ['supino declinado'], 'Peito', 'Barra', 'barbell decline bench press'],
  ['supino-reto-halter', 'Supino reto com halter', ['supino halter'], 'Peito', 'Halter', 'dumbbell bench press'],
  ['supino-inclinado-halter', 'Supino inclinado com halter', ['inclinado halter'], 'Peito', 'Halter', 'dumbbell incline bench press'],
  ['supino-maquina', 'Supino na máquina', ['chest press', 'supino articulado'], 'Peito', 'Máquina', 'lever chest press'],
  ['supino-smith', 'Supino no Smith', ['smith supino'], 'Peito', 'Smith', 'smith bench press'],
  ['crucifixo-halter', 'Crucifixo reto com halter', ['crucifixo', 'fly'], 'Peito', 'Halter', 'dumbbell fly'],
  ['crucifixo-maquina', 'Crucifixo na máquina', ['peck deck', 'voador', 'fly máquina'], 'Peito', 'Máquina', 'lever seated fly'],
  ['crossover', 'Crossover na polia', ['cross over', 'crucifixo polia'], 'Peito', 'Polia', 'cable cross-over variation'],
  ['flexao', 'Flexão de braço', ['flexão', 'apoio', 'push up'], 'Peito', 'Peso corporal', 'push-up'],
  ['paralelas-peito', 'Mergulho nas paralelas', ['paralela', 'dips'], 'Peito', 'Peso corporal', 'chest dip'],

  // Costas
  ['puxada-frontal', 'Puxada frontal', ['pulldown', 'puxada aberta', 'pulley frente'], 'Costas', 'Polia', 'cable lat pulldown full range of motion'],
  ['puxada-triangulo', 'Puxada com triângulo', ['puxada fechada', 'triângulo'], 'Costas', 'Polia', 'cable close grip front lat pulldown'],
  ['barra-fixa', 'Barra fixa', ['pull up', 'barra'], 'Costas', 'Peso corporal', 'pull-up'],
  ['remada-curvada', 'Remada curvada com barra', ['remada curvada', 'remada barra'], 'Costas', 'Barra', 'barbell bent over row'],
  ['remada-unilateral', 'Remada unilateral com halter', ['serrote', 'remada serrote'], 'Costas', 'Halter', 'dumbbell one arm bent-over row'],
  ['remada-baixa', 'Remada baixa na polia', ['remada sentada', 'remada baixa'], 'Costas', 'Polia', 'cable seated row'],
  ['remada-maquina', 'Remada na máquina', ['remada articulada'], 'Costas', 'Máquina', 'lever seated row'],
  ['remada-cavalinho', 'Remada cavalinho', ['t-bar', 'remada T'], 'Costas', 'Barra', 'lever t bar row'],
  ['pulldown-braco-reto', 'Pulldown com braço estendido', ['pullover polia', 'braço reto'], 'Costas', 'Polia', 'cable straight arm pulldown'],
  ['levantamento-terra', 'Levantamento terra', ['terra', 'deadlift'], 'Costas', 'Barra', 'barbell deadlift'],
  ['hiperextensao', 'Hiperextensão lombar', ['banco romano', 'lombar', 'extensão lombar'], 'Costas', 'Peso corporal', 'hyperextension'],
  ['encolhimento', 'Encolhimento com halter', ['trapézio', 'shrug'], 'Costas', 'Halter', 'dumbbell shrug'],

  // Ombros
  ['desenvolvimento-halter', 'Desenvolvimento com halter', ['desenvolvimento', 'press ombro'], 'Ombros', 'Halter', 'dumbbell seated shoulder press'],
  ['desenvolvimento-barra', 'Desenvolvimento militar com barra', ['militar', 'press militar'], 'Ombros', 'Barra', 'barbell seated overhead press'],
  ['desenvolvimento-maquina', 'Desenvolvimento na máquina', ['desenvolvimento articulado'], 'Ombros', 'Máquina', 'lever shoulder press'],
  ['elevacao-lateral', 'Elevação lateral com halter', ['lateral', 'elevação lateral'], 'Ombros', 'Halter', 'dumbbell lateral raise'],
  ['elevacao-lateral-polia', 'Elevação lateral na polia', ['lateral polia'], 'Ombros', 'Polia', 'cable lateral raise'],
  ['elevacao-frontal', 'Elevação frontal com halter', ['frontal'], 'Ombros', 'Halter', 'dumbbell front raise'],
  ['crucifixo-inverso', 'Crucifixo inverso', ['voador inverso', 'posterior de ombro', 'reverse fly'], 'Ombros', 'Máquina', 'lever seated reverse fly'],
  ['face-pull', 'Face pull', ['puxada para o rosto'], 'Ombros', 'Polia', 'cable rear delt row (with rope)'],
  ['remada-alta', 'Remada alta', ['upright row'], 'Ombros', 'Barra', 'barbell upright row'],

  // Bíceps
  ['rosca-direta', 'Rosca direta com barra', ['rosca direta', 'rosca barra'], 'Bíceps', 'Barra', 'barbell curl'],
  ['rosca-barra-w', 'Rosca com barra W', ['rosca W'], 'Bíceps', 'Barra W', 'ez barbell curl'],
  ['rosca-alternada', 'Rosca alternada com halter', ['alternada', 'rosca halter'], 'Bíceps', 'Halter', 'dumbbell alternate biceps curl'],
  ['rosca-martelo', 'Rosca martelo', ['martelo', 'hammer'], 'Bíceps', 'Halter', 'dumbbell hammer curl'],
  ['rosca-scott', 'Rosca Scott', ['scott', 'banco scott'], 'Bíceps', 'Barra W', 'ez barbell preacher curl'],
  ['rosca-concentrada', 'Rosca concentrada', ['concentrada'], 'Bíceps', 'Halter', 'dumbbell concentration curl'],
  ['rosca-polia', 'Rosca na polia', ['rosca cabo'], 'Bíceps', 'Polia', 'cable curl'],
  ['rosca-inclinada', 'Rosca inclinada com halter', ['rosca 45', 'rosca banco inclinado'], 'Bíceps', 'Halter', 'dumbbell incline curl'],

  // Tríceps
  ['triceps-pulley', 'Tríceps pulley com barra', ['pulley', 'tríceps barra'], 'Tríceps', 'Polia', 'cable pushdown'],
  ['triceps-corda', 'Tríceps na corda', ['corda', 'tríceps corda'], 'Tríceps', 'Polia', 'cable pushdown (with rope attachment)'],
  ['triceps-testa', 'Tríceps testa', ['testa', 'skull crusher'], 'Tríceps', 'Barra W', 'ez barbell lying triceps extension'],
  ['triceps-frances', 'Tríceps francês', ['francês', 'tríceps nuca'], 'Tríceps', 'Halter', 'dumbbell seated triceps extension'],
  ['triceps-coice', 'Tríceps coice', ['coice', 'kickback'], 'Tríceps', 'Halter', 'dumbbell kickback'],
  ['mergulho-banco', 'Mergulho no banco', ['tríceps banco', 'bench dip'], 'Tríceps', 'Peso corporal', 'bench dip (knees bent)'],
  ['supino-fechado', 'Supino fechado', ['supino pegada fechada'], 'Tríceps', 'Barra', 'barbell close-grip bench press'],

  // Antebraço
  ['rosca-punho', 'Rosca de punho', ['punho', 'flexão de punho'], 'Antebraço', 'Barra', 'barbell wrist curl'],
  ['rosca-inversa', 'Rosca inversa', ['pegada pronada'], 'Antebraço', 'Barra', 'barbell reverse curl'],

  // Quadríceps
  ['agachamento-livre', 'Agachamento livre', ['agachamento', 'squat'], 'Quadríceps', 'Barra', 'barbell full squat'],
  ['agachamento-smith', 'Agachamento no Smith', ['smith agachamento'], 'Quadríceps', 'Smith', 'smith squat'],
  ['agachamento-goblet', 'Agachamento goblet', ['goblet'], 'Quadríceps', 'Halter', 'dumbbell goblet squat'],
  ['leg-press', 'Leg press 45°', ['leg', 'leg 45', 'legpress'], 'Quadríceps', 'Máquina', 'sled 45° leg press'],
  ['hack', 'Agachamento hack', ['hack machine', 'hack'], 'Quadríceps', 'Máquina', 'sled hack squat'],
  ['cadeira-extensora', 'Cadeira extensora', ['extensora'], 'Quadríceps', 'Máquina', 'lever leg extension'],
  ['bulgaro', 'Agachamento búlgaro', ['búlgaro', 'split squat'], 'Quadríceps', 'Halter', 'dumbbell single leg split squat'],
  ['afundo', 'Afundo', ['passada', 'avanço', 'lunge'], 'Quadríceps', 'Halter', 'dumbbell lunge'],
  ['cadeira-isometrica', 'Cadeira isométrica', ['wall sit', 'isometria parede'], 'Quadríceps', 'Peso corporal', 'wall sit', 'tempo', 45],

  // Posterior
  ['mesa-flexora', 'Mesa flexora', ['flexora deitada', 'flexora'], 'Posterior', 'Máquina', 'lever lying leg curl'],
  ['cadeira-flexora', 'Cadeira flexora', ['flexora sentada'], 'Posterior', 'Máquina', 'lever seated leg curl'],
  ['stiff', 'Stiff', ['stiff barra'], 'Posterior', 'Barra', 'barbell straight leg deadlift'],
  ['terra-romeno', 'Levantamento terra romeno', ['romeno', 'RDL'], 'Posterior', 'Barra', 'barbell romanian deadlift'],

  // Glúteos
  ['elevacao-pelvica', 'Elevação pélvica', ['hip thrust', 'pélvica'], 'Glúteos', 'Barra', 'barbell glute bridge'],
  ['gluteo-polia', 'Glúteo na polia', ['coice polia', 'kickback glúteo'], 'Glúteos', 'Polia', 'cable kickback'],
  ['cadeira-abdutora', 'Cadeira abdutora', ['abdutora', 'abdução'], 'Glúteos', 'Máquina', 'lever seated hip abduction'],
  ['agachamento-sumo', 'Agachamento sumô', ['sumô'], 'Glúteos', 'Halter', 'sumo squat'],

  // Adutores
  ['cadeira-adutora', 'Cadeira adutora', ['adutora', 'adução'], 'Adutores', 'Máquina', 'lever seated hip adduction'],

  // Panturrilha
  ['panturrilha-em-pe', 'Panturrilha em pé', ['gêmeos', 'panturrilha'], 'Panturrilha', 'Máquina', 'lever standing calf raise'],
  ['panturrilha-sentado', 'Panturrilha sentado', ['sóleo', 'panturrilha banco'], 'Panturrilha', 'Máquina', 'lever seated calf raise'],
  ['panturrilha-leg', 'Panturrilha no leg press', ['panturrilha leg'], 'Panturrilha', 'Máquina', 'sled calf press on leg press'],

  // Abdômen
  ['abdominal-crunch', 'Abdominal crunch', ['abdominal', 'abdominal supra', 'crunch'], 'Abdômen', 'Peso corporal', 'crunch floor'],
  ['abdominal-infra', 'Elevação de pernas', ['abdominal infra', 'infra'], 'Abdômen', 'Peso corporal', 'lying leg raise flat bench'],
  ['abdominal-polia', 'Abdominal na polia', ['abdominal ajoelhado', 'cable crunch'], 'Abdômen', 'Polia', 'cable kneeling crunch'],
  ['abdominal-maquina', 'Abdominal na máquina', ['abdominal aparelho'], 'Abdômen', 'Máquina', 'lever seated crunch'],
  ['roda-abdominal', 'Roda abdominal', ['rodinha', 'ab wheel'], 'Abdômen', 'Peso corporal', 'wheel rollout'],
  ['russian-twist', 'Russian twist', ['giro russo', 'rotação'], 'Abdômen', 'Peso corporal', 'russian twist'],
  ['prancha', 'Prancha', ['prancha frontal', 'plank'], 'Abdômen', 'Peso corporal', 'front plank', 'tempo', 45],
  ['prancha-lateral', 'Prancha lateral', ['side plank'], 'Abdômen', 'Peso corporal', 'side plank', 'tempo', 30],

  // Cardio
  ['esteira', 'Esteira', ['corrida', 'caminhada'], 'Cardio', 'Aparelho aeróbico', 'walking on incline treadmill', 'tempo', 600],
  ['bicicleta', 'Bicicleta ergométrica', ['bike', 'bicicleta'], 'Cardio', 'Aparelho aeróbico', 'stationary bike walk', 'tempo', 600],
  ['eliptico', 'Elíptico', ['transport', 'elíptico'], 'Cardio', 'Aparelho aeróbico', 'elliptical machine walk', 'tempo', 600],
  ['escada', 'Escada', ['simulador de escada', 'stair'], 'Cardio', 'Aparelho aeróbico', 'walking on stepmill', 'tempo', 600],
  ['pular-corda', 'Pular corda', ['corda naval'], 'Cardio', 'Peso corporal', 'jump rope', 'tempo', 120],
];

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

    t.objectStore('config').put({ chave: 'seed_versao', valor: SEED_VERSAO });
  });
}
