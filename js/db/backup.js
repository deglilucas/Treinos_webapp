// Backup completo em JSON: exporta todos os stores e restaura substituindo tudo.

import { tx, req, getConfig, setConfig, getAllPorIndice } from './db.js';
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

/** Gera o arquivo, baixa e marca a data do último backup. Retorna o backup. */
export async function baixarBackup() {
  const backup = await exportarDados();
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `treinos-backup-${chaveData()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  await setConfig('ultimo_backup', chaveData());
  return backup;
}

const DIAS_SEM_BACKUP = 30;
const DIAS_ADIAR = 7;
const TREINOS_PARA_LEMBRAR = 3;

/**
 * Se está na hora de lembrar do backup: já tem alguns treinos feitos, nenhum
 * backup há 30 dias (ou nunca) e o lembrete não foi adiado.
 * @returns {Promise<{ultimo: string|null} | null>}
 */
export async function lembreteBackup(hoje = chaveData()) {
  const [ultimo, adiadoAte, feitos] = await Promise.all([
    getConfig('ultimo_backup'),
    getConfig('backup_adiado_ate'),
    getAllPorIndice('sessoes', 'status', 'concluida'),
  ]);
  if (feitos.length < TREINOS_PARA_LEMBRAR) return null;
  if (adiadoAte && adiadoAte > hoje) return null;
  const dias = ultimo ? Math.round((new Date(`${hoje}T12:00`) - new Date(`${ultimo}T12:00`)) / 86400000) : Infinity;
  return dias >= DIAS_SEM_BACKUP ? { ultimo, dias } : null;
}

export async function adiarLembreteBackup(hoje = new Date()) {
  const ate = new Date(hoje);
  ate.setDate(ate.getDate() + DIAS_ADIAR);
  await setConfig('backup_adiado_ate', chaveData(ate));
}

export function resumoBackup(backup) {
  const d = backup.dados;
  const concluidas = (d.sessoes ?? []).filter((s) => s.status === 'concluida').length;
  return `${(d.treinos ?? []).length} treinos, ${concluidas} sessões e ${(d.series_registradas ?? []).length} séries`;
}
