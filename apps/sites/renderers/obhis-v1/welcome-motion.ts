type Welcome = "olive" | "you";

/** Input-driven movement only. Vertical scrolling and zoom remain native. */
export function mountWelcomeMotion(stage: HTMLElement, choose: (scene: Welcome) => void, signal: AbortSignal) {
  const options = { signal };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0;
  let gesture: { id: number; x: number; y: number } | null = null;

  function resetGesture() {
    if (gesture && stage.hasPointerCapture(gesture.id)) stage.releasePointerCapture(gesture.id);
    gesture = null;
    delete stage.dataset.dragging;
    stage.style.removeProperty("--welcome-drag");
  }

  function updateDrift() {
    frame = 0;
    const rect = stage.getBoundingClientRect();
    const progress = reducedMotion.matches || document.hidden ? 0 : Math.min(1, Math.max(0, -rect.top / Math.min(rect.height, window.innerHeight)));
    stage.style.setProperty("--hero-drift", `${(progress * 64).toFixed(2)}px`);
  }

  function queueDrift() {
    if (!frame) frame = requestAnimationFrame(updateDrift);
  }

  stage.addEventListener("pointerdown", event => {
    if (!event.isPrimary || event.button !== 0 || !(event.target instanceof Element)) return;
    if (event.target.closest("a,button,summary,[role='group']")) return;
    if (event.pointerType === "mouse" && !event.target.closest(".olive-art,.you-art,.photo-print")) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }, options);
  stage.addEventListener("pointermove", event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const x = event.clientX - gesture.x;
    const y = event.clientY - gesture.y;
    if (Math.abs(y) > 10 && Math.abs(y) > Math.abs(x)) {
      resetGesture();
      return;
    }
    if (Math.abs(x) < 16 || Math.abs(x) < Math.abs(y) * 1.35) return;
    stage.setPointerCapture(event.pointerId);
    stage.dataset.dragging = "true";
    const allowed = stage.dataset.scene === "you" ? Math.max(0, x) : Math.min(0, x);
    stage.style.setProperty("--welcome-drag", `${Math.max(-120, Math.min(120, allowed))}px`);
  }, options);
  stage.addEventListener("pointerup", event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const x = event.clientX - gesture.x;
    const y = event.clientY - gesture.y;
    resetGesture();
    if (Math.abs(x) >= 64 && Math.abs(x) > Math.abs(y) * 1.35) choose(x < 0 ? "you" : "olive");
  }, options);
  stage.addEventListener("pointercancel", resetGesture, options);
  stage.addEventListener("lostpointercapture", event => {
    // Touch first captures the image. Its bubbling transfer is not cancellation.
    if (event.target === stage && gesture?.id === event.pointerId) resetGesture();
  }, options);
  stage.addEventListener("dragstart", event => {
    if (event.target instanceof HTMLImageElement) event.preventDefault();
  }, options);
  window.addEventListener("scroll", queueDrift, { ...options, passive: true });
  window.addEventListener("resize", queueDrift, options);
  reducedMotion.addEventListener("change", queueDrift, options);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      resetGesture();
      cancelAnimationFrame(frame);
      frame = 0;
    } else queueDrift();
  }, options);
  window.addEventListener("pagehide", () => {
    resetGesture();
    cancelAnimationFrame(frame);
    frame = 0;
  }, options);
  window.addEventListener("pageshow", queueDrift, options);
  stage.dataset.gestures = "true";
  queueDrift();

  return () => {
    resetGesture();
    cancelAnimationFrame(frame);
    delete stage.dataset.gestures;
    stage.style.removeProperty("--hero-drift");
  };
}
