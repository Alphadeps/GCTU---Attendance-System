// Repeat `fn` every `ms`, but only while the page is on screen. A tab left open in the
// background would otherwise keep the server and the free database awake all night.
// Runs once straight away when the person comes back to the tab. Returns a stop function.
export function pollWhileVisible(fn, ms) {
  const tick = () => { if (!document.hidden) fn(); };
  const id = setInterval(tick, ms);
  const onVisible = () => { if (!document.hidden) fn(); };
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    clearInterval(id);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
