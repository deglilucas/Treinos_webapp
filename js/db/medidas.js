// Medidas corporais: peso e circunferências, um registro por data.

import { getAll, get, put, del, novoId } from './db.js';

/** Campos de `medidas{}` na ordem em que aparecem no formulário. */
export const CAMPOS_MEDIDA = [
  { id: 'gordura', rotulo: '% de gordura', unidade: '%' },
  { id: 'peito', rotulo: 'Peito', unidade: 'cm' },
  { id: 'cintura', rotulo: 'Cintura', unidade: 'cm' },
  { id: 'abdomen', rotulo: 'Abdômen', unidade: 'cm' },
  { id: 'quadril', rotulo: 'Quadril', unidade: 'cm' },
  { id: 'braco_d', rotulo: 'Braço direito', unidade: 'cm' },
  { id: 'braco_e', rotulo: 'Braço esquerdo', unidade: 'cm' },
  { id: 'coxa_d', rotulo: 'Coxa direita', unidade: 'cm' },
  { id: 'coxa_e', rotulo: 'Coxa esquerda', unidade: 'cm' },
  { id: 'panturrilha', rotulo: 'Panturrilha', unidade: 'cm' },
];

/** Peso corporal + medidas, como uma lista única de indicadores. */
export const INDICADORES = [{ id: 'peso_corporal', rotulo: 'Peso', unidade: 'kg' }, ...CAMPOS_MEDIDA];

export const valorDe = (registro, id) =>
  (id === 'peso_corporal' ? registro.peso_corporal : registro.medidas?.[id]) ?? null;

/** Registros do mais antigo ao mais recente. */
export async function listarMedidas() {
  const lista = await getAll('medidas_corporais');
  return lista.sort((a, b) => a.data.localeCompare(b.data));
}

export const obterMedida = (id) => get('medidas_corporais', id);

export async function salvarMedida({ id, data, peso_corporal, medidas }) {
  const registro = { id: id ?? novoId(), data, peso_corporal: peso_corporal ?? null, medidas: medidas ?? {} };
  await put('medidas_corporais', registro);
  return registro;
}

export const excluirMedida = (id) => del('medidas_corporais', id);
