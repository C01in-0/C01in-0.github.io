(() => {
  'use strict';

  const root = document.documentElement;
  let scrollFrame = 0;
  let railFrame = 0;
  let scrollRail;
  let scrollThumb;
  let railDragging = false;
  let railDragOffset = 0;
  let liquidFrame = 0;
  let liquidPointerX = 0;
  let liquidResetTimer = 0;
  let arrivalTimer = 0;
  let wasScrolled = window.scrollY > 52;

  function requestedMode() {
    const requested = new URLSearchParams(location.search).get('navtest');
    if (requested === 'dock' || requested === 'liquid' || requested === 'islands') return requested;
    return 'liquid';
  }

  function preserveNavMode(nav, mode) {
    nav.querySelectorAll('a[href]').forEach(link => {
      let url;
      try { url = new URL(link.href, location.origin); } catch (_) { return; }
      if (url.origin !== location.origin) return;
      if (mode === 'dock' || mode === 'islands') url.searchParams.set('navtest', mode);
      else url.searchParams.delete('navtest');
      link.href = `${url.pathname}${url.search}${url.hash}`;
    });
  }

  function updateScrollState() {
    scrollFrame = 0;
    const isScrolled = window.scrollY > 52;
    root.classList.toggle('ops-nav-scrolled', isScrolled);
    const isArticle = Boolean(document.querySelector('#post'));
    if (wasScrolled && !isScrolled && !isArticle && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.classList.remove('ops-nav-arriving');
      void root.offsetWidth;
      root.classList.add('ops-nav-arriving');
      clearTimeout(arrivalTimer);
      arrivalTimer = setTimeout(() => root.classList.remove('ops-nav-arriving'), 320);
    }
    wasScrolled = isScrolled;
  }

  function initializeNavLab() {
    const nav = document.querySelector('#nav');
    if (!nav) return;
    const mode = requestedMode();
    root.dataset.opsNavMode = mode;
    nav.dataset.opsNavMode = mode;
    preserveNavMode(nav, mode);
    initializeNavSemantics(nav);
    initializeLiquidGlass(nav);
    initializeScrollRail();
    updateScrollState();
  }

  function initializeNavSemantics(nav) {
    const actions = [
      [nav.querySelector('#search-button > .search'), '打开搜索'],
      [nav.querySelector('#toggle-menu > .site-page'), '打开导航菜单']
    ];
    actions.forEach(([action, label]) => {
      if (!action || action.dataset.opsKeyboardReady === 'true') return;
      action.dataset.opsKeyboardReady = 'true';
      action.setAttribute('role', 'button');
      action.setAttribute('tabindex', '0');
      action.setAttribute('aria-label', label);
      action.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        action.click();
      });
    });

    const logo = nav.querySelector('.site-icon');
    if (logo) {
      logo.width = 36;
      logo.height = 36;
      logo.loading = 'eager';
      logo.fetchPriority = 'high';
    }
    const pageTitle = nav.querySelector('.nav-page-title > .site-name:first-child');
    if (pageTitle && !pageTitle.title) pageTitle.title = pageTitle.textContent.trim();
  }

  function initializeLiquidGlass(nav) {
    const menus = nav.querySelector('#menus');
    if (!menus || menus.dataset.opsLiquidReady === 'true') return;
    menus.dataset.opsLiquidReady = 'true';

    const cancelLiquidReset = () => {
      window.clearTimeout(liquidResetTimer);
      liquidResetTimer = 0;
    };

    const placeLiquidWithoutMotion = callback => {
      menus.classList.add('is-liquid-resetting');
      callback();
      requestAnimationFrame(() => menus.classList.remove('is-liquid-resetting'));
    };

    const scheduleLiquidReset = () => {
      cancelLiquidReset();
      if (menus.matches(':focus-within')) return;
      liquidResetTimer = window.setTimeout(() => {
        placeLiquidWithoutMotion(() => {
          menus.style.setProperty('--ops-liquid-x', '50%');
          menus.style.setProperty('--ops-liquid-bend', '0px');
        });
        liquidResetTimer = 0;
      }, 230);
    };

    function paintLiquidPosition() {
      liquidFrame = 0;
      const bounds = menus.getBoundingClientRect();
      if (!bounds.width) return;
      const lensWidth = Number.parseFloat(getComputedStyle(menus).getPropertyValue('--ops-liquid-lens-width')) || 68;
      const safeInset = Math.min(bounds.width / 2, Math.max(34, lensWidth / 2 + 4));
      const x = Math.max(safeInset, Math.min(bounds.width - safeInset, liquidPointerX - bounds.left));
      menus.style.setProperty('--ops-liquid-x', `${x.toFixed(1)}px`);
      if (root.dataset.opsNavMode === 'liquid') {
        const progress = (x / bounds.width) * 2 - 1;
        menus.style.setProperty('--ops-liquid-bend', `${(progress * 2.8).toFixed(2)}px`);
      }
    }

    menus.addEventListener('pointerenter', event => {
      if (event.pointerType === 'touch') return;
      cancelLiquidReset();
      liquidPointerX = event.clientX;
      placeLiquidWithoutMotion(() => paintLiquidPosition());
      requestAnimationFrame(() => menus.classList.add('is-liquid-active'));
    }, { passive: true });

    menus.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch') return;
      liquidPointerX = event.clientX;
      if (liquidFrame) return;
      liquidFrame = requestAnimationFrame(paintLiquidPosition);
    }, { passive: true });

    menus.addEventListener('pointerleave', () => {
      menus.classList.remove('is-liquid-active');
      menus.classList.remove('is-liquid-pressed');
      scheduleLiquidReset();
    }, { passive: true });

    menus.addEventListener('focusout', scheduleLiquidReset);

    menus.addEventListener('pointerdown', event => {
      if (event.pointerType === 'touch' || root.dataset.opsNavMode !== 'liquid') return;
      menus.classList.add('is-liquid-pressed');
    }, { passive: true });
    const releaseLiquid = () => menus.classList.remove('is-liquid-pressed');
    menus.addEventListener('pointerup', releaseLiquid, { passive: true });
    menus.addEventListener('pointercancel', releaseLiquid, { passive: true });
  }

  function onScroll() {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(updateScrollState);
  }

  function updateScrollRailState() {
    railFrame = 0;
    if (!scrollRail || !scrollThumb) return;
    const viewport = document.documentElement.clientHeight;
    const content = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    const maxScroll = Math.max(0, content - viewport);
    const thumbHeight = Math.max(44, Math.round((viewport / content) * viewport));
    const travel = Math.max(0, viewport - thumbHeight);
    const top = maxScroll ? (window.scrollY / maxScroll) * travel : 0;
    scrollRail.style.setProperty('--ops-scroll-thumb-size', `${thumbHeight}px`);
    scrollRail.style.setProperty('--ops-scroll-thumb-top', `${top}px`);
    scrollRail.hidden = maxScroll < 2;
  }

  function requestRailPaint() {
    if (railFrame) return;
    railFrame = requestAnimationFrame(updateScrollRailState);
  }

  function initializeScrollRail() {
    scrollRail = document.querySelector('.ops-scroll-rail');
    if (!scrollRail) {
      scrollRail = document.createElement('div');
      scrollRail.className = 'ops-scroll-rail';
      scrollRail.setAttribute('aria-hidden', 'true');
      scrollRail.innerHTML = '<span class="ops-scroll-thumb"></span>';
      document.body.appendChild(scrollRail);
    }
    scrollThumb = scrollRail.querySelector('.ops-scroll-thumb');
    root.classList.add('ops-scroll-rail-ready');
    if (scrollRail.dataset.opsReady === 'true') {
      requestRailPaint();
      return;
    }
    scrollRail.dataset.opsReady = 'true';
    scrollRail.addEventListener('pointerenter', () => scrollRail.classList.add('is-active'));
    scrollRail.addEventListener('pointerleave', () => {
      if (!railDragging) scrollRail.classList.remove('is-active');
    });
    scrollRail.addEventListener('pointerdown', event => {
      if (event.pointerType === 'touch' || event.button !== 0) return;
      event.preventDefault();
      railDragging = true;
      scrollRail.classList.add('is-active', 'is-dragging');
      scrollRail.setPointerCapture(event.pointerId);
      const thumbRect = scrollThumb.getBoundingClientRect();
      railDragOffset = event.target === scrollThumb ? event.clientY - thumbRect.top : thumbRect.height / 2;
      const move = moveEvent => {
        if (!railDragging) return;
        const viewport = document.documentElement.clientHeight;
        const content = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
        const maxScroll = Math.max(0, content - viewport);
        const thumbHeight = scrollThumb.getBoundingClientRect().height;
        const travel = Math.max(1, viewport - thumbHeight);
        const thumbTop = Math.max(0, Math.min(travel, moveEvent.clientY - railDragOffset));
        window.scrollTo({ top: (thumbTop / travel) * maxScroll, behavior: 'auto' });
      };
      const finish = () => {
        railDragging = false;
        scrollRail.classList.remove('is-dragging');
        scrollRail.removeEventListener('pointermove', move);
        scrollRail.removeEventListener('pointerup', finish);
        scrollRail.removeEventListener('pointercancel', finish);
      };
      scrollRail.addEventListener('pointermove', move);
      scrollRail.addEventListener('pointerup', finish);
      scrollRail.addEventListener('pointercancel', finish);
      move(event);
    });
    requestRailPaint();
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('scroll', requestRailPaint, { passive: true });
  window.addEventListener('resize', requestRailPaint, { passive: true });
  window.addEventListener('blur', () => scrollRail?.classList.remove('is-active'));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeNavLab);
  else initializeNavLab();
  document.addEventListener('pjax:complete', initializeNavLab);
})();
