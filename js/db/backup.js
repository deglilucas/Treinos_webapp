// Backup completo em JSON: exporta todos os stores e restaura substituindo tudo.

import { tx, req } from './db.js';
import { DB_VERSAO } from './schema.js';
import { chaveData } from '../lib/datas.js';

const STORES = [
  'exercicios', 'treinos', 'treino_exercicios', 'sessoes',
  'series_registradas', 'medidas_corporais', 'config',
];

export async function exportarDados() {
  const dados = await tx(STORES, 'readonly', async (t) => {
    const saida = {};
    for (const nome of STORES) saida[nome] = await req(t.objectStore(nome).getAll());
    return saida;
  });
  return { app: 'treinos', versao_db: DB_VERSAO, exportado_em: new Date().toISOString(), dados };
}

/** Lê o arquivo e confere se é um backup deste app. Lança erro com mensagem legível. */
export function validarBackup(texto) {
  let json;
  try { json = JSON.parse(texto); } catch { throw new Error('O arquivo não é um JSON válido.'); }
  if (json?.app !== 'treinos' || typeof json.dados !== 'object') {
    throw new Error('Esse arquivo não é um backup do Treinos.');
  }
  if (json.versao_db > DB_VERSAO) {
    throw new Error('Backup feito numa versão mais nova do app. Atualize o app antes de importar.');
  }
  return json;
}

/** Apaga tudo e grava o conteúdo do backup, numa transação só (ou vai tudo, ou nada). */
export function importarDados(backup) {
  return tx(STORES, 'readwrite', (t) => {
    for (const nome of STORES) {
      const store = t.objectStore(nome);
      store.clear();
      for (const registro of backup.dados[nome] ?? []) store.put(registro);
    }
    // O arquivo importado passa a ser o último backup conhecido.
    const quando = new Date(backup.exportado_em);
    if (!Number.isNaN(quando.getTime())) t.objectStore('config').put({ chave: 'ultimo_backup', valor: chaveData(quando) });
  });
}

export function resumoBackup(backup) {
  const d = backup.dados;
  const concluidas = (d.sessoes ?? []).filter((s) => s.status === 'concluida').length;
  return `${(d.treinos ?? []).length} treinos, ${concluidas} sessões e ${(d.series_registradas ?? []).length} séries`;
}
