// Datas de calendário em horário local, no formato 'YYYY-MM-DD'.

export const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export const INICIAIS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const dois = (n) => String(n).padStart(2, '0');

export function chaveData(d = new Date()) {
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

/** 'YYYY-MM-DD' → Date ao meio-dia local (evita escorregar de dia por horário de verão). */
export function deChave(chave) {
  const [a, m, d] = chave.split('-').map(Number);
  return new Date(a, m - 1, d, 12);
}

export function somarDias(chave, dias) {
  const d = deChave(chave);
  d.setDate(d.getDate() + dias);
  return chaveData(d);
}

/** Diferença em dias inteiros entre duas chaves (b - a). */
export function diasEntre(a, b) {
  return Math.round((deChave(b) - deChave(a)) / 86400000);
}

/** Domingo..sábado da semana que contém `chave`. */
export function semanaDe(chave) {
  const d = deChave(chave);
  const inicio = somarDias(chave, -d.getDay());
  return { inicio, fim: somarDias(inicio, 6) };
}

export const capitalizar = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** '2026-09-05' → '5 de setembro' */
export function diaMes(chave) {
  const d = deChave(chave);
  return `${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/** '2026-09-05' → 'Hoje, 5 de setembro' · 'Ontem, 4 de setembro' · '3 de setembro' */
export function rotuloDia(chave, hoje = chaveData()) {
  const d = deChave(chave);
  let texto = diaMes(chave);
  if (d.getFullYear() !== deChave(hoje).getFullYear()) texto += ` de ${d.getFullYear()}`;
  const dif = diasEntre(chave, hoje);
  if (dif === 0) return `Hoje, ${texto}`;
  if (dif === 1) return `Ontem, ${texto}`;
  return texto;
}

/** Intervalo curto: '1 a 2 de setembro' · '30 de agosto a 2 de setembro' */
export function rotuloIntervalo(ini, fim) {
  if (ini === fim) return diaMes(ini);
  const a = deChave(ini);
  const b = deChave(fim);
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} a ${b.getDate()} de ${MESES[b.getMonth()]}`;
  return `${a.getDate()} de ${MESES[a.getMonth()]} a ${b.getDate()} de ${MESES[b.getMonth()]}`;
}
