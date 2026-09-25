// Ícones em stroke (stroke-width 2), sempre herdando a cor do texto.
// Engrenagem baseada no Lucide (licença ISC).

const attrs = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

const caminhos = {
  inicio: '<path d="M3 11 12 3.5 21 11"/><path d="M5.5 9.5V20h13V9.5"/>',
  treinar: '<path d="M6.5 7v10"/><path d="M17.5 7v10"/><path d="M3.5 10v4"/><path d="M20.5 10v4"/><path d="M6.5 12h11"/>',
  progresso: '<path d="M6 20v-8"/><path d="M12 20V4"/><path d="M18 20v-5"/>',
  ajustes: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  voltar: '<path d="m15 18-6-6 6-6"/>',
  avancar: '<path d="m9 18 6-6-6-6"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  mais: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  fechar: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  menu: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  busca: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  lixeira: '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>',
  semSinal: '<path d="M2 2l20 20"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M5 12.9a10 10 0 0 1 5.2-2.8"/><path d="M19 12.9a10 10 0 0 0-2.3-1.6"/><path d="M12 20h.01"/>',
};

export function icone(nome, classe = 'icone') {
  return `<svg class="${classe}" ${attrs}>${caminhos[nome] ?? ''}</svg>`;
}
