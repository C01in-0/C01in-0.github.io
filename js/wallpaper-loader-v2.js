(() => {
  'use strict';

  const root = document.documentElement;
  const wallpaperUrl = '/images/littleblogwallpaper-ui-v1.jpg';
  let revealTimer = 0;

  function reveal(state) {
    root.classList.add(state);
    clearTimeout(revealTimer);
    revealTimer = window.setTimeout(() => root.classList.add('ops-wallpaper-settled'), 460);
  }

  function loadWallpaper() {
    if (root.dataset.opsWallpaperReady === 'true') return;
    root.dataset.opsWallpaperReady = 'true';
    root.classList.add('ops-wallpaper-gated');

    const image = new Image();
    image.decoding = 'async';
    image.fetchPriority = 'high';
    image.src = wallpaperUrl;

    const loaded = image.complete && image.naturalWidth
      ? Promise.resolve()
      : new Promise((resolve, reject) => {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', reject, { once: true });
        });

    const decoded = loaded.then(() => typeof image.decode === 'function' ? image.decode() : undefined);

    decoded.then(() => reveal('ops-wallpaper-ready')).catch(() => reveal('ops-wallpaper-fallback'));
  }

  loadWallpaper();
})();
