(() => {
  'use strict';

  if (window.__COLIN_METRICS_SCHEDULED__) return;
  window.__COLIN_METRICS_SCHEDULED__ = true;

  const REMOTE_SRC = 'https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js';
  let loaded = false;
  let remoteScript;

  function loadMetrics() {
    if (loaded || document.querySelector('script[data-ops-metrics-remote]')) return;
    loaded = true;
    ['pointerdown', 'keydown', 'scroll'].forEach(type => {
      window.removeEventListener(type, loadMetrics);
    });
    remoteScript = document.createElement('script');
    remoteScript.async = true;
    remoteScript.src = REMOTE_SRC;
    remoteScript.dataset.opsMetricsRemote = 'true';
    document.head.appendChild(remoteScript);
  }

  function scheduleMetrics() {
    setTimeout(() => {
      if ('requestIdleCallback' in window) requestIdleCallback(loadMetrics, { timeout: 2200 });
      else loadMetrics();
    }, 5200);
  }

  ['pointerdown', 'keydown', 'scroll'].forEach(type => window.addEventListener(type, loadMetrics, { passive: true }));

  if (document.readyState === 'complete') scheduleMetrics();
  else window.addEventListener('load', scheduleMetrics, { once: true });

  document.addEventListener('pjax:complete', () => {
    if (!loaded) return;
    loaded = false;
    remoteScript?.remove();
    document.querySelectorAll('script[src*="busuanzi?jsonpCallback="]').forEach(script => script.remove());
    loadMetrics();
  });
})();
