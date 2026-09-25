// Camada fina sobre o IndexedDB: abre o banco, roda migrações e expõe
// helpers com Promise. Consultas de domínio ficam em repo.js.

import { DB_NOME, DB_VERSAO, migrar } from './schema.js';

let conexao;

export function abrirDB() {
  if (conexao) return conexao;
  conexao = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NOME, DB_VERSAO);
    req.onupgradeneeded = (e) => migrar(req.result, e.oldVersion);
    req.onsuccess = () => {
      const db = req.result;
      // Outra aba abriu uma versão nova do banco: libera e recarrega.
      db.onversionchange = () => { db.close(); location.reload(); };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
  return conexao;
}

/** Transforma um IDBRequest em Promise. */
export function req(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/**
 * Roda `fn` dentro de uma transação e resolve com o retorno dela só depois
 * do commit. Se `fn` lançar erro, a transação é abortada (nada é gravado).
 */
export async function tx(stores, modo, fn) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, modo);
    let resultado;
    t.oncomplete = () => resolve(resultado);
    t.onabort = () => reject(t.error ?? new Error('Transação abortada'));
    Promise.resolve()
      .then(() => fn(t))
      .then((v) => { resultado = v; }, (err) => { try { t.abort(); } catch {} reject(err); });
  });
}

export const get = (store, chave) =>
  tx(store, 'readonly', (t) => req(t.objectStore(store).get(chave)));

export const getAll = (store) =>
  tx(store, 'readonly', (t) => req(t.objectStore(store).getAll()));

export const getAllPorIndice = (store, indice, consulta) =>
  tx(store, 'readonly', (t) => req(t.objectStore(store).index(indice).getAll(consulta)));

export const put = (store, valor) =>
  tx(store, 'readwrite', (t) => req(t.objectStore(store).put(valor)));

export const del = (store, chave) =>
  tx(store, 'readwrite', (t) => req(t.objectStore(store).delete(chave)));

export function novoId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export async function getConfig(chave, padrao = null) {
  const item = await get('config', chave);
  return item ? item.valor : padrao;
}

export const setConfig = (chave, valor) => put('config', { chave, valor });
