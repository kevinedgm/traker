const form = () => `
  <article class="log-sheet pulse-sheet" role="dialog" aria-modal="true" aria-label="Registrar día de Leer antes de dormir">
    <div class="sheet-handle"></div><header class="sheet-head"><div class="habit-id"><span class="habit-mark">12</span><div><strong>Leer antes de dormir</strong><span>Día 12 de 30</span></div></div><button class="sheet-close" aria-label="Cerrar">×</button></header>
    <p class="log-question">¿Cómo fue este día?</p><div class="log-levels"><button class="log-level">✓<span>Completo</span></button><button class="log-level" data-selected>−<span>Mínimo</span></button><button class="log-level">☾<span>Flexible</span></button></div>
    <div class="pulse-slot"><div class="minimal-rescue"><p>Una página mantiene el hábito disponible para mañana.</p><button class="minimal-trigger">Registrar mínimo</button></div>
    <div class="pulse-status" role="status"><span class="pulse-check">✓</span><div><strong>Hoy también cuenta</strong><small>Una página quedó registrada</small></div></div></div>
  </article>`

export default {
  css: `.pulse-sheet{position:relative}.pulse-slot{position:relative;min-height:72px;margin-top:18px}.pulse-slot .minimal-rescue{position:absolute;inset:0;margin:0;transition:opacity 140ms ease-out,transform 180ms ease-out}.pulse-status{position:absolute;inset:0;display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:var(--radius-lg);background:var(--state-complete-bg);opacity:0;transform:translateY(8px);pointer-events:none;transition:opacity 180ms ease-out,transform 220ms cubic-bezier(.16,1,.3,1)}.pulse-status strong,.pulse-status small{display:block;font-family:var(--font-core)}.pulse-status strong{color:var(--state-complete-fg);font-size:14px}.pulse-status small{margin-top:3px;color:var(--text-secondary);font-size:12px}.pulse-check{width:34px;height:34px;display:grid;place-items:center;border-radius:50%;background:var(--action-primary);color:var(--action-primary-fg);transform:scale(.65);transition:transform 220ms cubic-bezier(.16,1,.3,1)}.pulse-sheet[data-complete] .minimal-rescue{opacity:0;transform:translateY(-6px);pointer-events:none}.pulse-sheet[data-complete] .pulse-status{opacity:1;transform:translateY(0)}.pulse-sheet[data-complete] .pulse-check{transform:scale(1)}@media(prefers-reduced-motion:reduce){.pulse-status,.pulse-check,.pulse-slot .minimal-rescue{transition-duration:1ms;transform:none}}`,
  render: form,
  mount(root) {
    const sheet = root.querySelector('.pulse-sheet')
    const button = root.querySelector('.minimal-trigger')
    button.addEventListener('click', () => { sheet.dataset.complete = ''; button.textContent = 'Registrado ✓' })
    root.querySelector('.sheet-close').addEventListener('click', () => { sheet.hidden = true })
  },
}
