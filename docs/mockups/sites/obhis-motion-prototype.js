const stage = document.getElementById('hero-stage');
const controls = document.querySelector('.scene-controls');
const buttons = [...controls.querySelectorAll('[data-scene-choice]')];
const panels = [...stage.querySelectorAll('[data-panel]')];
const status = document.getElementById('scene-status');
let currentScene = null;
let readinessFrame = 0;

function sceneFromUrl() {
  return new URLSearchParams(location.search).get('scene') === 'you' ? 'you' : 'olive';
}

function setScene(scene, updateUrl = true) {
  if (scene === currentScene) return;
  const previousScene = currentScene;
  const chosenButton = buttons.find(button => button.dataset.sceneChoice === scene);
  const focusedPanel = panels.find(panel => panel.contains(document.activeElement));
  if (focusedPanel && focusedPanel.dataset.panel !== scene) chosenButton.focus({ preventScroll: true });
  currentScene = scene;
  stage.dataset.scene = scene;
  panels.forEach(panel => {
    const active = panel.dataset.panel === scene;
    panel.hidden = false;
    panel.inert = !active;
    panel.setAttribute('aria-hidden', String(!active));
  });
  buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.sceneChoice === scene)));
  if (previousScene !== null) {
    status.textContent = scene === 'you' ? 'You. Bring your whole bright self.' : 'Olive. A place for all your colours.';
  }
  if (updateUrl) {
    const url = new URL(location.href);
    url.searchParams.set('scene', scene);
    history.pushState(null, '', url);
  }
}

function settleMotion() {
  stage.classList.remove('motion-ready');
  cancelAnimationFrame(readinessFrame);
  // Commit the selected pose before re-enabling transitions. A focused link
  // must never remain outside the clipping boundary of a moving page.
  stage.getBoundingClientRect();
  readinessFrame = requestAnimationFrame(() => {
    readinessFrame = 0;
    stage.classList.add('motion-ready');
  });
}

buttons.forEach(button => button.addEventListener('click', () => setScene(button.dataset.sceneChoice)));
controls.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  const scene = event.key === 'ArrowRight' ? 'you' : 'olive';
  buttons.find(button => button.dataset.sceneChoice === scene).focus({ preventScroll: true });
  setScene(scene);
});
stage.addEventListener('focusin', event => {
  if (event.target.closest('.scene')) settleMotion();
});
window.addEventListener('popstate', () => setScene(sceneFromUrl(), false));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) settleMotion();
});
window.addEventListener('pagehide', () => {
  cancelAnimationFrame(readinessFrame);
  readinessFrame = 0;
  stage.classList.remove('motion-ready');
});
window.addEventListener('pageshow', event => {
  if (event.persisted) settleMotion();
});
setScene(sceneFromUrl(), false);
controls.hidden = false;
settleMotion();
