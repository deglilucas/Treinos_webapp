// Aba Ajustes: treinos, biblioteca de exercícios e backup.
// Subtelas: #/ajustes/treino/:id, #/ajustes/treino/:id/adicionar,
// #/ajustes/exercicios, #/ajustes/exercicio/:id (ou 'novo'), #/ajustes/catalogo.

import { listarTreinos, nomeCompletoTreino } from '../db/repo.js';
import { getAll, getAllPorIndice, getConfig } from '../db/db.js';
import { criarTreino, moverTreino } from '../db/edicao.js';
import { baixarBackup, validarBackup, importarDados, resumoBackup } from '../db/backup.js';
import { rotuloDia } from '../lib/datas.js';
import { esc, $, toast } from '../ui/dom.js';
import { icone } from '../ui/icones.js';
import { abrirSheet } from '../ui/sheet.js';
import { ir } from '../router.js';
import { suportado, permissao, estaAtivado, ativar, desativar } from '../lib/notificacoes.js';
import * as editorTreino from './treino-editor.js';
import * as adicionarExercicio from './adicionar-exercicio.js';
import * as biblioteca from './biblioteca.js';
import * as formExercicio from './exercicio-form.js';
import * as catalogo from './catalogo.js';

export async function render(view, rota) {
  const [sub, id, acao] = rota.params;
  if (sub === 'treino' && id && acao === 'adicionar') return adicionarExercicio.render(view, id);
  if (sub === 'treino' && id) return editorTreino.render(view, id);
  if (sub === 'exercicios') return biblioteca.render(view);
  if (sub === 'catalogo') return catalogo.render(view, rota.query);
  if (sub === 'exercicio' && id) return formExercicio.render(view, id, rota.query);
  ordenando = false; // entrar na aba sempre começa fora do modo de ordenar
  return principal(view);
}

// Modo de ordenar a rotação dos treinos (setas no lugar do link).
let ordenando = false;

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

    <div class="secao-cabecalho">
      <h2 class="rotulo-secao">Meus treinos</h2>
      ${treinos.length > 1 ? `<button type="button" class="botao-texto" id="ordenar-treinos">${ordenando ? 'Pronto' : 'Ordenar'}</button>` : ''}
    </div>
    ${ordenando ? '<p class="texto-apoio fraco">O treino sugerido para hoje segue esta ordem: depois do último feito, vem o de baixo.</p>' : ''}
    <div class="lista">
      ${treinos.map((t, i) => {
        const conteudo = `
          <div class="selo">${esc(t.sigla)}</div>
          <div class="item-texto">
            <div class="item-titulo">${esc(nomeCompletoTreino(t))}</div>
            <div class="item-sub">${contagens[i] === 1 ? '1 exercício' : `${contagens[i]} exercícios`}</div>
          </div>`;
        return ordenando ? `
          <div class="item-historico">
            ${conteudo}
            <div class="ordem-botoes">
              <button type="button" class="botao-icone" data-mover-treino="${esc(t.id)}" data-delta="-1" aria-label="Subir Treino ${esc(t.sigla)}" ${i === 0 ? 'disabled' : ''}>${icone('cima')}</button>
              <button type="button" class="botao-icone" data-mover-treino="${esc(t.id)}" data-delta="1" aria-label="Descer Treino ${esc(t.sigla)}" ${i === treinos.length - 1 ? 'disabled' : ''}>${icone('baixo')}</button>
            </div>
          </div>` : `
          <a class="item-historico item-link" href="#/ajustes/treino/${esc(t.id)}">
            ${conteudo}
            ${icone('avancar')}
          </a>`;
      }).join('') || '<div class="vazio">Nenhum treino ainda.</div>'}
      ${ordenando ? '' : `<button type="button" class="botao" id="novo-treino">${icone('mais')}Novo treino</button>`}
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

    <h2 class="rotulo-secao">Treino</h2>
    <div class="card">
      <div class="linha-opcao">
        <div class="item-texto">
          <div class="item-titulo">Notificação durante o treino</div>
          <div class="item-sub" id="estado-notificacao"></div>
        </div>
        <button type="button" class="interruptor" id="alternar-notificacao" role="switch" aria-checked="false" aria-label="Notificação durante o treino"><span></span></button>
      </div>
      <p class="texto-apoio fraco">Com o app em segundo plano, mostra o descanso ou a série atual com botão para iniciar ou concluir, e apita no alvo. O bipe funciona para alvos de até uns 5 minutos.</p>
    </div>

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

  const interruptor = $('#alternar-notificacao', view);
  const mostrarNotificacao = () => {
    const perm = permissao();
    const ligado = estaAtivado();
    interruptor.setAttribute('aria-checked', String(ligado));
    interruptor.disabled = perm === 'sem-suporte' || perm === 'denied';
    $('#estado-notificacao', view).textContent = !suportado() ? 'Este navegador não suporta notificações'
      : perm === 'denied' ? 'Bloqueada nas permissões do navegador para este site'
        : ligado ? 'Ativada' : 'Desativada';
  };
  mostrarNotificacao();
  interruptor.onclick = async () => {
    if (estaAtivado()) await desativar();
    else {
      const resultado = await ativar();
      if (resultado !== 'granted') toast('O navegador não liberou a notificação');
    }
    mostrarNotificacao();
  };

  const botaoOrdenar = $('#ordenar-treinos', view);
  if (botaoOrdenar) botaoOrdenar.onclick = () => { ordenando = !ordenando; principal(view); };
  view.querySelectorAll('[data-mover-treino]').forEach((b) => {
    b.onclick = async () => {
      await moverTreino(b.dataset.moverTreino, Number(b.dataset.delta));
      principal(view);
    };
  });

  const botaoNovo = $('#novo-treino', view);
  if (botaoNovo) botaoNovo.onclick = async () => {
    const treino = await criarTreino();
    ir(`ajustes/treino/${treino.id}`);
  };

  $('#exportar', view).onclick = async () => {
    const backup = await baixarBackup();
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
