// The Poké Ball curtain the game plays between screens: the red top half and the dark
// bottom half close over the screen with the ball's button spinning in, the next screen
// is built behind it, then the halves open again (same timings as the original).
let busy = false;

export function wipe(change) {
  if (busy) { change(); return; }
  busy = true;
  const el = document.createElement('div');
  el.className = 'wipe';
  el.innerHTML = '<i class="w-top"></i><i class="w-bot"></i><b class="w-btn"></b>';
  document.body.append(el);
  setTimeout(() => requestAnimationFrame(() => {
    Promise.resolve()
      .then(change)
      .catch(() => {})
      .then(() => requestAnimationFrame(() => {
        el.classList.add('open');
        setTimeout(() => { el.remove(); busy = false; }, 700);
      }));
  }), 520);
}
