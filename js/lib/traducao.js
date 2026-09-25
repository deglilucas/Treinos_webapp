// Busca em português no catálogo (que está em inglês): cada termo de academia
// vira as palavras equivalentes em inglês. Tudo sem acento e em minúsculas.

import { normalizar } from '../db/edicao.js';

// Expressões de mais de uma palavra vêm antes, para serem reconhecidas inteiras.
const DICIONARIO = [
  ['posterior de coxa', ['hamstring', 'leg curl']],
  ['posterior de ombro', ['rear delt', 'rear', 'reverse fly']],
  ['barra fixa', ['pull-up', 'pullup', 'chin-up']],
  ['elevacao lateral', ['lateral raise', 'side lateral']],
  ['elevacao frontal', ['front raise']],
  ['elevacao pelvica', ['hip thrust', 'glute bridge']],
  ['leg press', ['leg press']],
  ['cadeira extensora', ['leg extension']],
  ['mesa flexora', ['lying leg curl']],
  ['cadeira flexora', ['seated leg curl']],
  ['em pe', ['standing']],
  ['peso corporal', ['bodyweight', 'body']],
  ['pegada fechada', ['close-grip', 'close grip']],
  ['pegada aberta', ['wide-grip', 'wide grip']],
  ['supino', ['bench press', 'chest press', 'press']],
  ['agachamento', ['squat']],
  ['remada', ['row']],
  ['rosca', ['curl']],
  ['puxada', ['pulldown', 'pull-down']],
  ['pulldown', ['pulldown']],
  ['flexao', ['push-up', 'pushup']],
  ['desenvolvimento', ['shoulder press', 'military press', 'overhead press']],
  ['elevacao', ['raise']],
  ['crucifixo', ['fly', 'flye']],
  ['voador', ['butterfly', 'fly']],
  ['terra', ['deadlift']],
  ['afundo', ['lunge']],
  ['passada', ['lunge']],
  ['avanco', ['lunge']],
  ['bulgaro', ['split squat']],
  ['encolhimento', ['shrug']],
  ['mergulho', ['dip']],
  ['paralela', ['dip', 'parallel']],
  ['paralelas', ['dip', 'parallel']],
  ['prancha', ['plank', 'bridge']],
  ['abdominal', ['crunch', 'ab ', 'sit-up']],
  ['infra', ['leg raise', 'reverse crunch']],
  ['obliquo', ['oblique']],
  ['alongamento', ['stretch']],
  ['alongar', ['stretch']],
  ['coice', ['kickback']],
  ['martelo', ['hammer']],
  ['testa', ['skullcrusher', 'lying triceps']],
  ['frances', ['overhead triceps', 'triceps extension']],
  ['extensao', ['extension']],
  ['extensora', ['extension']],
  ['flexora', ['leg curl']],
  ['panturrilha', ['calf']],
  ['posterior', ['hamstring', 'rear', 'posterior', 'leg curl']],
  ['isquiotibiais', ['hamstring']],
  ['quadriceps', ['quad', 'squat', 'leg extension']],
  ['trapezio', ['shrug', 'trap']],
  ['dorsal', ['lat ', 'pulldown', 'row']],
  ['deltoide', ['deltoid', 'shoulder']],
  ['abdomen', ['ab ', 'crunch']],
  ['adutor', ['adductor', 'adduction']],
  ['abdutor', ['abductor', 'abduction']],
  ['serrote', ['one-arm dumbbell row']],
  ['cavalinho', ['t-bar']],
  ['pulley', ['pushdown', 'pulldown', 'cable']],
  ['lateral', ['lateral', 'side']],
  ['frontal', ['front']],
  ['mobilidade', ['stretch', 'circles', 'rotation']],
  ['gemeos', ['calf']],
  ['gluteo', ['glute']],
  ['quadril', ['hip']],
  ['adutora', ['adductor', 'adduction']],
  ['abdutora', ['abductor', 'abduction']],
  ['lombar', ['lower back', 'hyperextension', 'back extension']],
  ['costas', ['back', 'lat']],
  ['peito', ['chest']],
  ['ombro', ['shoulder', 'deltoid']],
  ['triceps', ['triceps', 'tricep']],
  ['biceps', ['biceps', 'bicep', 'curl']],
  ['antebraco', ['forearm', 'wrist']],
  ['punho', ['wrist']],
  ['perna', ['leg']],
  ['coxa', ['thigh', 'leg']],
  ['halter', ['dumbbell']],
  ['halteres', ['dumbbell']],
  ['barra', ['barbell', 'bar']],
  ['polia', ['cable']],
  ['cabo', ['cable']],
  ['corda', ['rope']],
  ['maquina', ['machine', 'lever']],
  ['anilha', ['plate']],
  ['elastico', ['band']],
  ['bola', ['ball']],
  ['inclinado', ['incline']],
  ['declinado', ['decline']],
  ['reto', ['flat', 'bench']],
  ['sentado', ['seated']],
  ['deitado', ['lying']],
  ['unilateral', ['one-arm', 'one arm', 'single', 'one-leg', 'one leg']],
  ['invertida', ['reverse', 'inverted']],
  ['inversa', ['reverse']],
  ['inverso', ['reverse']],
  ['salto', ['jump']],
  ['pular', ['jump']],
  ['corrida', ['run', 'jog', 'sprint']],
  ['esteira', ['treadmill']],
  ['bicicleta', ['bike', 'bicycl']],
  ['bike', ['bike', 'bicycl']],
  ['escada', ['stair']],
  ['remo', ['rowing']],
  ['rotacao', ['rotation', 'twist']],
  ['giro', ['twist']],
  ['caminhada', ['walk']],
  ['treno', ['sled']],
  ['empurrar', ['push']],
];

/**
 * Transforma a busca em grupos de alternativas: o exercício precisa bater com
 * todos os grupos, e em cada grupo basta uma alternativa.
 */
function gruposDaBusca(termo) {
  let resto = ` ${normalizar(termo).replace(/\s+/g, ' ').trim()} `;
  const grupos = [];
  for (const [pt, en] of DICIONARIO) {
    if (resto.includes(` ${pt} `)) {
      grupos.push([pt, ...en]);
      resto = resto.replace(` ${pt} `, ' ');
    }
  }
  for (const palavra of resto.split(' ').filter(Boolean)) grupos.push([palavra]);
  return grupos;
}

// Hífen e parênteses contam como espaço: "Two-Dumbbell" tem a palavra "dumbbell".
const semHifen = (s) => normalizar(s).replace(/[-_()]/g, ' ').replace(/ +/g, ' ');

/** Nome em inglês bate com a busca em português (ou inglês)? */
export function combinaCatalogo(exercicio, termo) {
  const grupos = gruposDaBusca(termo);
  if (!grupos.length) return true;
  const alvo = ` ${semHifen(exercicio.nome)} `;
  // Cada alternativa precisa começar uma palavra ("rear" não casa com "forearm").
  return grupos.every((alternativas) => alternativas.some((a) => alvo.includes(` ${semHifen(a)}`)));
}
