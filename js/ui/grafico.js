// Gráfico de linha em SVG para uma série só (a evolução de um exercício).
// Linha de 2px, pontos com anel da cor do fundo, grade em hairline e uma
// linha-guia que segue o dedo/mouse até o ponto mais próximo, com o valor.

const NS = 'http://www.w3.org/2000/svg';
const ALTURA = 210;
const MARGEM = { topo: 22, direita: 18, base: 28, esquerda: 46 };

function svg(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/** Escala com marcas redondas (0, 25, 50…) cobrindo [min, max]. */
export function escalaBonita(min, max, alvo = 4) {
  if (min === max) {
    const folga = Math.abs(min) * 0.1 || 1;
    min -= folga;
    max += folga;
  }
  const bruto = (max - min) / alvo;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= bruto);
  const ini = Math.floor(min / passo) * passo;
  const fim = Math.ceil(max / passo) * passo;
  const casas = Math.max(0, -Math.floor(Math.log10(passo)) + 1);
  const marcas = [];
  for (let v = ini; v <= fim + passo / 2; v += passo) marcas.push(Number(v.toFixed(casas)));
  return { ini, fim, marcas };
}

/**
 * @param {HTMLElement} el container (position: relative)
 * @param {{t: number, y: number, rotuloData: string, detalhe?: string}[]} pontos em ordem de t
 * @param {{formatar: (y: number) => string, formatarEixo?: (y: number) => string, zeroNaBase?: boolean}} opcoes
 */
export function graficoLinha(el, pontos, { formatar, formatarEixo = formatar, zeroNaBase = false }) {
  const largura = Math.max(260, el.clientWidth);
  const plotL = largura - MARGEM.esquerda - MARGEM.direita;
  const plotA = ALTURA - MARGEM.topo - MARGEM.base;

  const ys = pontos.map((p) => p.y);
  const { ini, fim, marcas } = escalaBonita(zeroNaBase ? 0 : Math.min(...ys), Math.max(...ys));
  const t0 = pontos[0].t;
  const t1 = pontos.at(-1).t;
  const x = (t) => MARGEM.esquerda + (t1 === t0 ? plotL / 2 : ((t - t0) / (t1 - t0)) * plotL);
  const y = (v) => MARGEM.topo + plotA - ((v - ini) / (fim - ini)) * plotA;

  const raiz = svg('svg', {
    viewBox: `0 0 ${largura} ${ALTURA}`, width: largura, height: ALTURA,
    class: 'grafico-svg', role: 'img',
    'aria-label': `Evolução: de ${formatar(pontos[0].y)} em ${pontos[0].rotuloData} a ${formatar(pontos.at(-1).y)} em ${pontos.at(-1).rotuloData}`,
  });

  // Grade e eixo Y
  for (const v of marcas) {
    raiz.append(svg('line', { x1: MARGEM.esquerda, x2: largura - MARGEM.direita, y1: y(v), y2: y(v), class: 'grafico-grade' }));
    const rotulo = svg('text', { x: MARGEM.esquerda - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'grafico-eixo' });
    rotulo.textContent = formatarEixo(v);
    raiz.append(rotulo);
  }

  // Eixo X: primeira, última e (se couber) a do meio
  const indicesX = [0, pontos.length - 1];
  if (pontos.length > 2 && plotL > 240) indicesX.splice(1, 0, Math.floor((pontos.length - 1) / 2));
  indicesX.forEach((i, pos) => {
    const anchor = pos === 0 ? 'start' : pos === indicesX.length - 1 ? 'end' : 'middle';
    const rotulo = svg('text', { x: x(pontos[i].t), y: ALTURA - 8, 'text-anchor': anchor, class: 'grafico-eixo' });
    rotulo.textContent = pontos[i].rotuloData;
    raiz.append(rotulo);
  });

  // Área (lavagem 10%) e linha
  const caminho = pontos.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');
  const base = MARGEM.topo + plotA;
  raiz.append(svg('path', { d: `${caminho} L${x(t1).toFixed(1)},${base} L${x(t0).toFixed(1)},${base} Z`, class: 'grafico-area' }));
  raiz.append(svg('path', { d: caminho, class: 'grafico-linha' }));

  // Pontos (em séries longas, só o último fica visível)
  const mostrarTodos = pontos.length <= 30;
  pontos.forEach((p, i) => {
    if (mostrarTodos || i === pontos.length - 1) {
      raiz.append(svg('circle', { cx: x(p.t), cy: y(p.y), r: 4, class: 'grafico-ponto' }));
    }
  });

  // Rótulo só no último ponto; vai para baixo quando a linha chega descendo (não cruza o texto).
  const ultimo = pontos.at(-1);
  const penultimo = pontos.at(-2);
  const descendo = penultimo && penultimo.y > ultimo.y && y(ultimo.y) + 22 < base;
  const rotuloFim = svg('text', {
    x: x(ultimo.t), y: y(ultimo.y) + (descendo ? 22 : -12),
    'text-anchor': x(ultimo.t) > largura - 60 ? 'end' : 'middle',
    class: 'grafico-rotulo',
  });
  rotuloFim.textContent = formatar(ultimo.y);
  raiz.append(rotuloFim);

  // Camada de leitura
  const guia = svg('line', { y1: MARGEM.topo, y2: base, class: 'grafico-guia', visibility: 'hidden' });
  const marcador = svg('circle', { r: 6, class: 'grafico-ponto grafico-ponto-ativo', visibility: 'hidden' });
  const alvo = svg('rect', {
    x: MARGEM.esquerda - 12, y: 0, width: plotL + 24, height: ALTURA, class: 'grafico-alvo',
  });
  raiz.append(guia, marcador, alvo);

  const dica = document.createElement('div');
  dica.className = 'grafico-dica';
  dica.hidden = true;
  const dicaValor = document.createElement('strong');
  const dicaData = document.createElement('span');
  const dicaDetalhe = document.createElement('span');
  dica.append(dicaValor, dicaData, dicaDetalhe);

  el.replaceChildren(raiz, dica);
  el.tabIndex = 0;

  let atual = -1;
  function mostrar(i) {
    atual = i;
    const p = pontos[i];
    const px = x(p.t);
    guia.setAttribute('x1', px);
    guia.setAttribute('x2', px);
    marcador.setAttribute('cx', px);
    marcador.setAttribute('cy', y(p.y));
    guia.setAttribute('visibility', 'visible');
    marcador.setAttribute('visibility', 'visible');
    dicaValor.textContent = formatar(p.y);
    dicaData.textContent = p.rotuloData;
    dicaDetalhe.textContent = p.detalhe ?? '';
    dicaDetalhe.hidden = !p.detalhe;
    dica.hidden = false;
    const larguraDica = dica.offsetWidth;
    dica.style.left = `${Math.min(largura - larguraDica, Math.max(0, px - larguraDica / 2))}px`;
  }
  function esconder() {
    atual = -1;
    guia.setAttribute('visibility', 'hidden');
    marcador.setAttribute('visibility', 'hidden');
    dica.hidden = true;
  }
  function maisProximo(evento) {
    const caixa = raiz.getBoundingClientRect();
    const px = ((evento.clientX - caixa.left) / caixa.width) * largura;
    let melhor = 0;
    pontos.forEach((p, i) => { if (Math.abs(x(p.t) - px) < Math.abs(x(pontos[melhor].t) - px)) melhor = i; });
    return melhor;
  }

  alvo.addEventListener('pointerdown', (e) => mostrar(maisProximo(e)));
  alvo.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || e.buttons) mostrar(maisProximo(e)); });
  alvo.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') esconder(); });
  // Atribuição direta: redesenhar (ex.: ao girar a tela) não acumula ouvintes.
  el.onkeydown = (e) => {
    if (e.key === 'ArrowLeft') mostrar(Math.max(0, (atual < 0 ? pontos.length : atual) - 1));
    else if (e.key === 'ArrowRight') mostrar(Math.min(pontos.length - 1, atual + 1));
    else if (e.key === 'Escape') esconder();
    else return;
    e.preventDefault();
  };
  el.onblur = esconder;
}
