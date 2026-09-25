// Registrar ou corrigir medidas corporais de uma data.

import { listarMedidas, obterMedida, salvarMedida, excluirMedida, CAMPOS_MEDIDA } from '../db/medidas.js';
import { chaveData } from '../lib/datas.js';
import { esc, $, toast } from '../ui/dom.js';
import { cabecalhoVoltar } from '../ui/controles.js';
import { abrirSheet } from '../ui/sheet.js';
import { ir } from '../router.js';

const fmt = (v) => (v == null ? '' : String(v).replace('.', ','));
const ler = (txt) => {
  if (!String(txt).trim()) return null;
  const v = parseFloat(String(txt).replace(',', '.'));
  return Number.isFinite(v) && v > 0 ? v : undefined;
};

export async function render(view, id) {
  const nova = id === 'nova';
  const registro = nova ? null : await obterMedida(id);
  if (!nova && !registro) {
    location.replace('#/progresso');
    return;
  }
  // Os valores da última vez viram dica nos campos de um registro novo.
  const ultima = nova ? (await listarMedidas()).at(-1) : null;
  const valor = (campo) => (campo === 'peso_corporal' ? registro?.peso_corporal : registro?.medidas?.[campo]);
  const dica = (campo) => {
    const v = campo === 'peso_corporal' ? ultima?.peso_corporal : ultima?.medidas?.[campo];
    return v != null ? `última: ${fmt(v)}` : '';
  };

  const campoNumero = (nome, rotulo, unidade) => `
    <label class="campo-rotulo campo-medida">${esc(rotulo)} <span class="unidade">${unidade}</span>
      <input class="entrada" name="${nome}" inputmode="decimal" autocomplete="off"
        value="${esc(fmt(valor(nome)))}" placeholder="${esc(dica(nome))}">
    </label>`;

  view.classList.add('com-acao');
  view.innerHTML = `
    ${cabecalhoVoltar(nova ? 'Registrar medidas' : 'Editar medidas', 'progresso')}
    <form class="formulario" id="form-medidas" novalidate>
      <label class="campo-rotulo">Data
        <input class="entrada" type="date" name="data" max="${chaveData()}" value="${esc(registro?.data ?? chaveData())}" required>
      </label>
      ${campoNumero('peso_corporal', 'Peso corporal', 'kg')}
      <p class="texto-apoio fraco">Preencha só o que mediu. Os outros campos podem ficar vazios.</p>
      <div class="grade-medidas">
        ${CAMPOS_MEDIDA.map((c) => campoNumero(c.id, c.rotulo, c.unidade)).join('')}
      </div>
      ${nova ? '' : '<button type="button" class="botao botao-fantasma" id="excluir-medida">Excluir registro</button>'}
    </form>
    <div class="acao-fixa">
      <button type="submit" form="form-medidas" class="botao botao-primario">Salvar</button>
    </div>`;

  const form = $('#form-medidas', view);
  form.addEventListener('input', (e) => e.target.classList?.remove('erro'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = new FormData(form);
    const data = dados.get('data');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      form.data.classList.add('erro');
      return;
    }
    let invalido = false;
    const lerCampo = (nome) => {
      const v = ler(dados.get(nome));
      if (v === undefined) { form[nome].classList.add('erro'); invalido = true; }
      return v ?? null;
    };
    const peso = lerCampo('peso_corporal');
    const medidas = {};
    for (const c of CAMPOS_MEDIDA) {
      const v = lerCampo(c.id);
      if (v != null) medidas[c.id] = v;
    }
    if (invalido) {
      toast('Tem um valor que não é número');
      return;
    }
    if (peso == null && !Object.keys(medidas).length) {
      toast('Preencha pelo menos uma medida');
      return;
    }
    await salvarMedida({ id: registro?.id, data, peso_corporal: peso, medidas });
    ir('progresso');
    toast(nova ? 'Medidas registradas' : 'Medidas atualizadas');
  });

  const excluir = $('#excluir-medida', view);
  if (excluir) {
    excluir.onclick = async () => {
      const ok = await abrirSheet({
        titulo: 'Excluir este registro?',
        texto: 'As medidas dessa data saem do histórico.',
        acoes: [{ id: 'sim', rotulo: 'Excluir registro' }],
      });
      if (!ok) return;
      await excluirMedida(registro.id);
      ir('progresso');
      toast('Registro excluído');
    };
  }
}
