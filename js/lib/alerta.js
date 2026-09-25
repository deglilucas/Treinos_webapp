// Aviso de fim de descanso: vibração + bipe curto.
// O áudio só pode ser liberado a partir de um toque do usuário, por isso
// prepararAudio() é chamado ao registrar uma série.

let ctx;

export function prepararAudio() {
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch { /* sem áudio, fica só a vibração */ }
}

export function alertar() {
  navigator.vibrate?.([200, 100, 200]);
  if (!ctx) return;
  const t = ctx.currentTime;
  [0, 0.28].forEach((atraso) => {
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    osc.frequency.value = 880;
    ganho.gain.setValueAtTime(0.0001, t + atraso);
    ganho.gain.exponentialRampToValueAtTime(0.35, t + atraso + 0.02);
    ganho.gain.exponentialRampToValueAtTime(0.0001, t + atraso + 0.2);
    osc.connect(ganho).connect(ctx.destination);
    osc.start(t + atraso);
    osc.stop(t + atraso + 0.22);
  });
}
