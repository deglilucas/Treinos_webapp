// Aba Ajustes: treinos, biblioteca de exercícios e backup.
// Subtelas: #/ajustes/treino/:id, #/ajustes/treino/:id/adicionar,
// #/ajustes/exercicios, #/ajustes/exercicio/:id (ou 'novo').

import { listarTreinos, nomeCompletoTreino } from '../db/repo.js';
import { getAll, getAllPorIndice, getConfig, setConfig } from '../db/db.js';
import { criarTreino } from '../db/edicao.js';
import { exportarDados, validarBackup, importarDados, resumoBackup } from '../db/backup.js';
import { chaveData, rotuloDia } from '../lib/datas.js';
import { esc, $, toast } from '../ui/dom.js';
import { icone } from '../ui/icones.js';
import { abrirSheet } from '../ui/sheet.js';
import { ir } from '../router.js';
import * as editorTreino from './treino-editor.js';
import * as adicionarExercicio from './adicionar-exercicio.js';
import * as biblioteca from './biblioteca.js';
import * as formExercicio from './exercicio-form.js';

export async function render(view, rota) {
  const [sub, id, acao] = rota.params;
  if (sub === 'treino' && id && acao === 'adicionar') return adicionarExercicio.render(view, id);
  if (sub === 'treino' && id) return editorTreino.render(view, id);
  if (sub === 'exercicios') return biblioteca.render(view);
  if (sub === 'exercicio' && id) return formExercicio.render(view, id, rota.query);
  return principal(view);
}

async function principal(view) {
  const [treinos, exercicios, ultimoBackup] = await Promise.all([
    listarTreinos(), getAll('exercicios'), getConfig('ultimo_backup'),
  ]);
  const contagens = await Promise.all(
    treinos.map((t) => getAllPorIndice('treino_exercicios', 'treino_id', t.id).then((l) => l.length)),
  );
  const pessoais = exercicios.filter((e) => e.personalizado && e.ativo !== false).length;

  view.innerHTML = `
    <h1 class="titulo">Ajustes</h1>

    <h2 class="rotulo-secao">Meus treinos</h2>
    <div class="lista">
      ${treinos.map((t, i) => `
        <a class="item-historico item-link" href="#/ajustes/treino/${esc(t.id)}">
          <div class="selo">${esc(t.sigla)}</div>
          <div class="item-texto">
            <div class="item-titulo">${esc(nomeCompletoTreino(t))}</div>
            <div class="item-sub">${contagens[i] === 1 ? '1 exercício' : `${contagens[i]} exercícios`}</div>
          </div>
          ${icone('avancar')}
        </a>`).join('') || '<div class="vazio">Nenhum treino ainda.</div>'}
      <button type="button" class="botao" id="novo-treino">${icone('mais')}Novo treino</button>
    </div>

    <h2 class="rotulo-secao">Biblioteca</h2>
    <a class="item-historico item-link" href="#/ajustes/exercicios">
      <div class="selo">${icone('treinar')}</div>
      <div class="item-texto">
        <div class="item-titulo">Exercícios</div>
        <div class="item-sub">${exercicios.length} na biblioteca${pessoais ? ` · ${pessoais} seus` : ''}</div>
      </div>
      ${icone('avancar')}
    </a>

    <h2 class="rotulo-secao">Backup</h2>
    <div class="card">
      <p class="texto-apoio">Seus dados ficam só neste aparelho. Exporte um backup de vez em quando
        e guarde o arquivo fora do celular (Drive, e-mail).</p>
      <p class="texto-apoio fraco">${ultimoBackup ? `Último backup: ${esc(rotuloDia(ultimoBackup))}` : 'Nenhum backup feito ainda.'}</p>
      <div class="botoes-lado">
        <button type="button" class="botao" id="exportar">${icone('baixar')}Exportar</button>
        <button type="button" class="botao" id="importar">${icone('enviar')}Importar</button>
      </div>
      <input type="file" id="arquivo-backup" accept="application/json,.json" hidden>
    </div>`;

  $('#novo-treino', view).onclick = async () => {
    const treino = await criarTreino();
    ir(`ajustes/treino/${treino.id}`);
  };

  $('#exportar', view).onclick = async () => {
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
    toast(`Backup exportado: ${resumoBackup(backup)}`);
    principal(view);
  };

  const entrada = $('#arquivo-backup', view);
  $('#importar', view).onclick = () => entrada.click();
  entrada.onchange = async () => {
    const arquivo = entrada.files[0];
    entrada.value = '';
    if (!arquivo) return;
    let backup;
    try {
      backup = validarBackup(await arquivo.text());
    } catch (err) {
      toast(err.message);
      return;
    }
    const ok = await abrirSheet({
      titulo: 'Substituir os dados?',
      texto: `O backup tem ${resumoBackup(backup)}. Tudo o que está neste aparelho agora será trocado por ele.`,
      acoes: [{ id: 'sim', rotulo: 'Importar backup', primario: true }],
    });
    if (!ok) return;
    await importarDados(backup);
    toast('Backup importado');
    ir('inicio');
  };
}
