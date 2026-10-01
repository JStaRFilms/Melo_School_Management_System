/** One six-second scene timer. Automatic changes never steal focus or history. */
export function mountWelcomeCycle(stage: HTMLElement, button: HTMLButtonElement, advance: () => void, signal: AbortSignal) {
  const options = { signal };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let timer = 0;
  let inView = false;
  let paused = false;
  let suspended = false;

  function clearTimer() {
    window.clearTimeout(timer);
    timer = 0;
  }

  function update() {
    if (signal.aborted) return;
    clearTimer();
    const playing = !paused && !reducedMotion.matches && inView && !document.hidden && !suspended;
    stage.dataset.playing = String(playing);
    button.disabled = reducedMotion.matches;
    button.setAttribute("aria-pressed", String(paused));
    button.setAttribute("aria-label", reducedMotion.matches ? "Automatic welcomes disabled by reduced-motion preference" : paused ? "Play welcome slideshow" : "Pause welcome slideshow");
    if (playing) timer = window.setTimeout(() => {
      timer = 0;
      advance();
      update();
    }, 6000);
  }

  function pause() {
    paused = true;
    update();
  }

  button.addEventListener("click", () => {
    paused = !paused;
    update();
  }, options);
  stage.addEventListener("focusin", event => {
    if (event.target !== button) pause();
  }, options);
  stage.addEventListener("pointerdown", event => {
    if (event.target instanceof Element && !event.target.closest("button,a")) pause();
  }, options);
  reducedMotion.addEventListener("change", update, options);
  document.addEventListener("visibilitychange", update, options);
  window.addEventListener("pagehide", () => {
    suspended = true;
    update();
  }, options);
  window.addEventListener("pageshow", () => {
    suspended = false;
    update();
  }, options);
  const observer = new IntersectionObserver(entries => {
    inView = entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= .2);
    update();
  }, { threshold: [0, .2] });
  observer.observe(stage);
  update();

  return {
    pause,
    stop() {
      clearTimer();
      observer.disconnect();
      delete stage.dataset.playing;
      button.disabled = false;
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", "Pause welcome slideshow");
    },
  };
}
