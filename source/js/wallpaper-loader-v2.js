(() => {
  'use strict';

  const root = document.documentElement;
  const wallpaperUrl = '/images/littleblogwallpaper-ui-v1.jpg';
  const openingDurationMs = 4600;
  let settleTimer = 0;

  function scheduleSettle() {
    clearTimeout(settleTimer);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.classList.add('ops-wallpaper-static');
      root.classList.add('ops-wallpaper-settled');
      return;
    }
    settleTimer = window.setTimeout(
      () => root.classList.add('ops-wallpaper-settled'),
      openingDurationMs
    );
  }

  function loadWallpaper() {
    if (root.dataset.opsWallpaperReady === 'true') return;
    root.dataset.opsWallpaperReady = 'true';
    root.classList.add('ops-wallpaper-gated');
    scheduleSettle();

    const image = new Image();
    image.decoding = 'async';
    image.fetchPriority = 'high';
    image.addEventListener('load', () => root.classList.add('ops-wallpaper-ready'), { once: true });
    image.addEventListener('error', () => root.classList.add('ops-wallpaper-fallback'), { once: true });
    image.src = wallpaperUrl;
  }

  loadWallpaper();
})();
