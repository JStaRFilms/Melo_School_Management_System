import { mountWelcomeMotion } from "./welcome-motion";
import { mountWelcomeCycle } from "./welcome-cycle";

function required<T extends Element>(root: HTMLElement, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing private review element: ${selector}`);
  return element;
}

/** One mounted homepage owns these listeners, frames and native dialog state. */
export function mountInteractions(root: HTMLElement) {
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const stage = required<HTMLElement>(root, ".hero-stage");
  const sceneControls = required<HTMLElement>(root, ".scene-controls");
  const sceneButtons = [...sceneControls.querySelectorAll<HTMLButtonElement>("[data-scene-choice]")];
  const scenePosition = required<HTMLElement>(stage, "[data-scene-position]");
  const heroImages = [...stage.querySelectorAll<HTMLImageElement>("[data-hero-photo]")];
  const playButton = required<HTMLButtonElement>(stage, "[data-welcome-play]");
  const momentCount = required<HTMLElement>(stage, ".hero-photo-stack").children.length;
  const panels = [...stage.querySelectorAll<HTMLElement>("[data-panel]")];
  const sceneStatus = required<HTMLElement>(root, "#scene-status");
  const collectionControls = required<HTMLElement>(root, ".album-choices");
  const collectionButtons = [...collectionControls.querySelectorAll<HTMLButtonElement>("[data-collection-choice]")];
  const sheets = [...root.querySelectorAll<HTMLElement>(".album-sheet")];
  const albumGrid = required<HTMLElement>(root, "#album-photos");
  const albumStatus = required<HTMLElement>(root, "#album-status");
  const viewer = required<HTMLDialogElement>(root, ".photo-viewer");
  const viewerImage = required<HTMLImageElement>(root, "#viewer-image");
  const viewerCaption = required<HTMLElement>(root, "#viewer-caption");
  const viewerPosition = required<HTMLElement>(root, "#viewer-position");
  const closeButton = required<HTMLButtonElement>(root, "#viewer-close");
  const previousButton = required<HTMLButtonElement>(root, "#viewer-previous");
  const nextButton = required<HTMLButtonElement>(root, "#viewer-next");
  const photos = sheets.map(sheet => ({
    source: required<HTMLAnchorElement>(sheet, ".album-photo").href,
    description: required<HTMLImageElement>(sheet, "img").alt,
    caption: required<HTMLElement>(sheet, "figcaption strong").textContent,
    album: required<HTMLElement>(sheet, "figcaption div > span").textContent,
  }));
  let currentScene: "olive" | "you" | null = null;
  let currentCollection: "day" | "culture" | null = null;
  let readinessFrame = 0;
  let currentPhoto = 0;
  let currentMoment = 0;
  let opener: HTMLAnchorElement | null = null;

  function sceneFromUrl() {
    return new URLSearchParams(window.location.search).get("scene") === "you" ? "you" : "olive";
  }

  function setScene(scene: "olive" | "you", updateUrl = true, announce = true) {
    if (scene === currentScene) return;
    const previous = currentScene;
    const controlsHadFocus = sceneControls.contains(document.activeElement);
    const focusedPanel = panels.find(panel => panel.contains(document.activeElement));
    const leavingPanel = focusedPanel && focusedPanel.dataset.panel !== scene;
    if (leavingPanel) sceneControls.focus({ preventScroll: true });
    currentScene = scene;
    if (scene === "olive" && previous !== null) chooseMoment(currentMoment + 1);
    stage.dataset.scene = scene;
    for (const panel of panels) {
      const active = panel.dataset.panel === scene;
      panel.inert = !active;
      panel.setAttribute("aria-hidden", String(!active));
      panel.hidden = false;
    }
    for (const button of sceneButtons) button.disabled = button.dataset.sceneChoice === scene;
    scenePosition.textContent = scene === "you" ? "02 / 02" : "01 / 02";
    if (controlsHadFocus && announce) sceneControls.focus({ preventScroll: true });
    if (previous !== null && announce) sceneStatus.textContent = scene === "you" ? "A place for you." : "Meet Olive.";
    if (updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set("scene", scene);
      window.history.pushState(null, "", url);
    }
  }

  function settleMotion() {
    stage.classList.remove("motion-ready");
    cancelAnimationFrame(readinessFrame);
    // Commit the chosen pose before transitions resume, keeping focus in view.
    stage.getBoundingClientRect();
    readinessFrame = requestAnimationFrame(() => {
      readinessFrame = 0;
      stage.classList.add("motion-ready");
    });
  }

  function chooseCollection(collection: "day" | "culture") {
    if (collection === currentCollection) return;
    const previous = currentCollection;
    const focusedSheet = sheets.find(sheet => sheet.contains(document.activeElement));
    if (focusedSheet && focusedSheet.dataset.collection !== collection) {
      collectionButtons.find(button => button.dataset.collectionChoice === collection)?.focus({ preventScroll: true });
    }
    currentCollection = collection;
    for (const sheet of sheets) sheet.hidden = sheet.dataset.collection !== collection;
    for (const button of collectionButtons) button.setAttribute("aria-pressed", String(button.dataset.collectionChoice === collection));
    if (previous !== null) albumStatus.textContent = collection === "day" ? "Two school-day photographs." : "Two cultural-day photographs.";
  }

  function showPhoto(index: number) {
    currentPhoto = (index + photos.length) % photos.length;
    const photo = photos[currentPhoto];
    viewerImage.src = photo.source;
    viewerImage.alt = photo.description;
    viewerCaption.textContent = `${photo.caption} ${photo.album}`;
    viewerPosition.textContent = `${currentPhoto + 1} of ${photos.length}`;
  }

  function chooseMoment(index: number) {
    currentMoment = (index + momentCount) % momentCount;
    for (const image of heroImages) image.hidden = Number(image.dataset.heroPhoto) !== currentMoment;
  }

  root.addEventListener("click", event => {
    if (!(event.target instanceof Element)) return;
    const scene = event.target.closest<HTMLButtonElement>("[data-scene-choice]")?.dataset.sceneChoice;
    if (scene === "olive" || scene === "you") {
      cycle.pause();
      setScene(scene);
    }
    const collection = event.target.closest<HTMLButtonElement>("[data-collection-choice]")?.dataset.collectionChoice;
    if (collection === "day" || collection === "culture") chooseCollection(collection);
    const link = event.target.closest<HTMLAnchorElement>("a");
    if (!link || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const photo = link.dataset.photo;
    if (photo !== undefined && typeof viewer.showModal === "function") {
      event.preventDefault();
      cycle.pause();
      opener = link;
      showPhoto(Number(photo));
      viewer.showModal();
      closeButton.focus({ preventScroll: true });
    }
  }, options);

  sceneControls.addEventListener("keydown", event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const scene = event.key === "ArrowRight" ? "you" : "olive";
    cycle.pause();
    setScene(scene);
    sceneControls.focus({ preventScroll: true });
  }, options);
  collectionControls.addEventListener("keydown", event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const collection = event.key === "ArrowRight" ? "culture" : "day";
    collectionButtons.find(button => button.dataset.collectionChoice === collection)?.focus({ preventScroll: true });
    chooseCollection(collection);
  }, options);
  stage.addEventListener("focusin", event => {
    if (event.target instanceof Element && event.target.closest(".scene")) settleMotion();
  }, options);
  window.addEventListener("popstate", () => {
    cycle.pause();
    setScene(sceneFromUrl(), false);
  }, options);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) settleMotion();
  }, options);
  window.addEventListener("pagehide", () => {
    cancelAnimationFrame(readinessFrame);
    readinessFrame = 0;
    stage.classList.remove("motion-ready");
  }, options);
  window.addEventListener("pageshow", event => {
    if (event.persisted) settleMotion();
  }, options);

  closeButton.addEventListener("click", () => viewer.close(), options);
  previousButton.addEventListener("click", () => showPhoto(currentPhoto - 1), options);
  nextButton.addEventListener("click", () => showPhoto(currentPhoto + 1), options);
  viewer.addEventListener("close", () => {
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    opener = null;
  }, options);
  viewer.addEventListener("keydown", event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    // Keep Tab inside the native viewer, including Chromium's BODY boundary.
    if (event.key === "Tab") {
      if (document.activeElement === (event.shiftKey ? closeButton : nextButton)) {
        event.preventDefault();
        (event.shiftKey ? nextButton : closeButton).focus();
      }
      return;
    }
    if (event.shiftKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    showPhoto(currentPhoto + (event.key === "ArrowRight" ? 1 : -1));
  }, options);

  setScene(sceneFromUrl(), false);
  chooseCollection("day");
  sceneControls.hidden = false;
  collectionControls.hidden = false;
  chooseMoment(0);
  albumGrid.dataset.enhanced = "true";
  settleMotion();
  const cycle = mountWelcomeCycle(stage, playButton, () => {
    setScene(currentScene === "olive" ? "you" : "olive", false, false);
  }, controller.signal);
  const stopWelcomeMotion = mountWelcomeMotion(stage, scene => {
    cycle.pause();
    setScene(scene);
  }, controller.signal);

  return () => {
    controller.abort();
    stopWelcomeMotion();
    cycle.stop();
    cancelAnimationFrame(readinessFrame);
    stage.classList.remove("motion-ready");
    if (viewer.open) viewer.close();
    opener = null;
    sceneControls.hidden = true;
    collectionControls.hidden = true;
    chooseMoment(0);
    scenePosition.textContent = "01 / 02";
    for (const button of sceneButtons) button.disabled = button.dataset.sceneChoice === "olive";
    delete albumGrid.dataset.enhanced;
    for (const sheet of sheets) sheet.hidden = false;
    stage.dataset.scene = "olive";
    for (const panel of panels) {
      const active = panel.dataset.panel === "olive";
      panel.hidden = !active;
      panel.inert = !active;
      panel.setAttribute("aria-hidden", String(!active));
    }
    sceneStatus.textContent = "";
    albumStatus.textContent = "";
  };
}
