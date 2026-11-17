// The live 3D valley behind the menus, drawn by the browser like the original game does, so it
// never loops or cuts. The still frame (set in CSS) shows at once; the valley loads after the
// page has drawn and fades in over it once its models and trees are in place.

export function startScene(box) {
  const canvas = box.querySelector('canvas');
  let valley = null;
  let visible = true;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return { show() {}, hide() {} };

  const begin = () => {
    import('./valley.js').then(({ startValley }) => {
      try {
        valley = startValley(canvas, { onReady: () => canvas.classList.add('on') });
        if (!visible) valley.pause();
      } catch { /* No WebGL: the still frame stays. */ }
    }).catch(() => {});
  };
  if (window.requestIdleCallback) window.requestIdleCallback(begin, { timeout: 800 });
  else setTimeout(begin, 300);

  return {
    show() { visible = true; valley?.resume(); },
    hide() { visible = false; valley?.pause(); },
  };
}
