const collectionControls = document.querySelector('.album-choices');
const collectionButtons = [...collectionControls.querySelectorAll('[data-collection-choice]')];
const albumSheets = [...document.querySelectorAll('.album-sheet')];
const albumStatus = document.getElementById('album-status');
let currentCollection = null;

function chooseCollection(collection) {
  if (currentCollection === collection) return;
  const previousCollection = currentCollection;
  currentCollection = collection;
  albumSheets.forEach(sheet => {
    sheet.hidden = sheet.dataset.collection !== collection;
  });
  collectionButtons.forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.collectionChoice === collection));
  });
  if (previousCollection !== null) {
    albumStatus.textContent = collection === 'day' ? 'Two photographs from the school-visit album.' : 'Two photographs from the cultural-day albums.';
  }
}

collectionButtons.forEach(button => {
  button.addEventListener('click', () => chooseCollection(button.dataset.collectionChoice));
});
collectionControls.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  const collection = event.key === 'ArrowRight' ? 'culture' : 'day';
  collectionButtons.find(button => button.dataset.collectionChoice === collection).focus({ preventScroll: true });
  chooseCollection(collection);
});
chooseCollection('day');
collectionControls.hidden = false;
document.getElementById('album-photos').dataset.enhanced = 'true';

const photoViewer = document.getElementById('photo-viewer');
const viewerImage = document.getElementById('viewer-image');
const viewerCaption = document.getElementById('viewer-caption');
const viewerPosition = document.getElementById('viewer-position');
const albumPhotos = [...document.querySelectorAll('.album-photo')].map(link => ({
  source: link.getAttribute('href'),
  description: link.querySelector('img').alt,
  caption: link.parentElement.querySelector('figcaption strong').textContent,
  album: link.parentElement.querySelector('figcaption div > span').textContent,
}));
let currentPhoto = 0;

function showPhoto(index) {
  currentPhoto = (index + albumPhotos.length) % albumPhotos.length;
  const photo = albumPhotos[currentPhoto];
  viewerImage.src = photo.source;
  viewerImage.alt = photo.description;
  viewerCaption.textContent = `${photo.caption} ${photo.album}`;
  viewerPosition.textContent = `${currentPhoto + 1} of ${albumPhotos.length}`;
}

if (typeof photoViewer.showModal === 'function') {
  document.querySelectorAll('[data-photo]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      showPhoto(Number(link.dataset.photo));
      photoViewer.showModal();
    });
  });
}
document.getElementById('viewer-close').addEventListener('click', () => photoViewer.close());
document.getElementById('viewer-previous').addEventListener('click', () => showPhoto(currentPhoto - 1));
document.getElementById('viewer-next').addEventListener('click', () => showPhoto(currentPhoto + 1));
photoViewer.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  // Native Chromium dialogs briefly return focus to BODY at the Tab boundary.
  if (event.key === 'Tab') {
    const boundary = event.shiftKey ? 'viewer-close' : 'viewer-next';
    if (document.activeElement.id === boundary) {
      event.preventDefault();
      document.getElementById(event.shiftKey ? 'viewer-next' : 'viewer-close').focus();
    }
    return;
  }
  if (event.shiftKey) return;
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  showPhoto(currentPhoto + (event.key === 'ArrowRight' ? 1 : -1));
});

document.querySelectorAll('a[href="#visit-guide"]').forEach(link => {
  link.addEventListener('click', () => {
    document.getElementById('visit-guide').open = true;
  });
});
