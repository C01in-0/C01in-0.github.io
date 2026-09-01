(() => {
  'use strict';

  const DATA_URL = '/data/article-glossary-v1.json?v=20260901-r3';
  const TERM_SELECTOR = '[data-glossary-term]';
  const COLLECTION_SELECTOR = '[data-glossary-collection]';
  const TOOLTIP_ID = 'article-glossary-tooltip';
  const HOVER_QUERY = window.matchMedia('(hover: hover) and (pointer: fine)');

  let dataPromise;
  let tooltip;
  let activeTerm;
  let pinned = false;
  let closeTimer;
  let repositionFrame;

  const loadData = () => {
    if (!dataPromise) {
      dataPromise = fetch(DATA_URL, { credentials: 'same-origin' })
        .then(response => {
          if (!response.ok) throw new Error(`Glossary data returned ${response.status}`);
          return response.json();
        })
        .catch(error => {
          dataPromise = null;
          throw error;
        });
    }
    return dataPromise;
  };

  const makeElement = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (typeof text === 'string') node.textContent = text;
    return node;
  };

  const ensureTooltip = () => {
    const existing = document.getElementById(TOOLTIP_ID);
    if (existing) {
      tooltip = existing;
      return tooltip;
    }

    tooltip = makeElement('aside', 'article-glossary-tooltip');
    tooltip.id = TOOLTIP_ID;
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('aria-hidden', 'true');
    tooltip.dataset.placement = 'top';

    const head = makeElement('div', 'article-glossary-tooltip__head');
    head.append(
      makeElement('span', 'article-glossary-tooltip__kicker', '术语'),
      makeElement('strong', 'article-glossary-tooltip__title')
    );
    tooltip.append(
      head,
      makeElement('p', 'article-glossary-tooltip__definition'),
      makeElement('p', 'article-glossary-tooltip__context'),
      makeElement('div', 'article-glossary-tooltip__links')
    );

    tooltip.addEventListener('mouseenter', cancelScheduledClose);
    tooltip.addEventListener('mouseleave', () => {
      if (!pinned) scheduleClose(90);
    });
    document.body.appendChild(tooltip);
    return tooltip;
  };

  const appendLinks = (parent, term, className) => {
    const links = Array.isArray(term.links) ? term.links : [];
    if (!links.length) return;
    const wrap = makeElement('span', className);
    links.forEach((link, index) => {
      if (index) wrap.append(document.createTextNode(' · '));
      const anchor = makeElement('a', '', link.label || '官方资料');
      anchor.href = link.url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      wrap.append(anchor);
    });
    parent.append(wrap);
  };

  const setTooltipContent = term => {
    const title = tooltip.querySelector('.article-glossary-tooltip__title');
    const definition = tooltip.querySelector('.article-glossary-tooltip__definition');
    const context = tooltip.querySelector('.article-glossary-tooltip__context');
    const links = tooltip.querySelector('.article-glossary-tooltip__links');
    title.textContent = term.label;
    definition.textContent = term.definition;
    context.textContent = term.context || '';
    context.hidden = !term.context;
    links.replaceChildren();
    appendLinks(links, term, 'article-glossary-links');
    links.hidden = !links.childElementCount;
  };

  const positionTooltip = () => {
    if (!tooltip || !activeTerm || !tooltip.classList.contains('is-visible')) return;

    const termRect = activeTerm.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportPadding = 12;
    const gap = 10;
    const spaceAbove = termRect.top - gap - viewportPadding;
    const spaceBelow = window.innerHeight - termRect.bottom - gap - viewportPadding;
    const placement = spaceAbove >= tooltipRect.height || spaceAbove >= spaceBelow
      ? 'top'
      : 'bottom';

    let left = termRect.left + termRect.width / 2 - tooltipRect.width / 2;
    left = Math.max(viewportPadding, Math.min(left, window.innerWidth - tooltipRect.width - viewportPadding));
    let top = placement === 'top'
      ? termRect.top - tooltipRect.height - gap
      : termRect.bottom + gap;
    top = Math.max(
      viewportPadding,
      Math.min(top, window.innerHeight - tooltipRect.height - viewportPadding)
    );

    const arrowLeft = Math.max(14, Math.min(
      termRect.left + termRect.width / 2 - left,
      tooltipRect.width - 14
    ));

    tooltip.dataset.placement = placement;
    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
    tooltip.style.setProperty('--glossary-arrow-left', `${Math.round(arrowLeft)}px`);
  };

  const queuePosition = () => {
    if (repositionFrame) cancelAnimationFrame(repositionFrame);
    repositionFrame = requestAnimationFrame(() => {
      repositionFrame = 0;
      positionTooltip();
    });
  };

  const closeTooltip = () => {
    cancelScheduledClose();
    if (activeTerm) {
      activeTerm.setAttribute('aria-expanded', 'false');
      activeTerm.removeAttribute('aria-describedby');
    }
    activeTerm = null;
    pinned = false;
    if (!tooltip) return;
    tooltip.classList.remove('is-visible');
    tooltip.setAttribute('aria-hidden', 'true');
  };

  function cancelScheduledClose() {
    if (!closeTimer) return;
    window.clearTimeout(closeTimer);
    closeTimer = 0;
  }

  function scheduleClose(delay = 70) {
    cancelScheduledClose();
    closeTimer = window.setTimeout(closeTooltip, delay);
  }

  const openTooltip = async (termNode, shouldPin = false) => {
    cancelScheduledClose();
    const key = termNode.dataset.glossaryTerm;

    try {
      const data = await loadData();
      const term = data.terms?.[key];
      if (!term || !document.documentElement.contains(termNode)) return;

      ensureTooltip();
      if (activeTerm && activeTerm !== termNode) activeTerm.setAttribute('aria-expanded', 'false');
      activeTerm = termNode;
      pinned = shouldPin;
      activeTerm.setAttribute('aria-expanded', 'true');
      activeTerm.setAttribute('aria-describedby', TOOLTIP_ID);
      setTooltipContent(term);
      tooltip.setAttribute('aria-hidden', 'false');
      tooltip.classList.add('is-visible');
      queuePosition();
    } catch (error) {
      termNode.dataset.glossaryState = 'unavailable';
      console.warn('[article-glossary] Unable to load glossary data.', error);
    }
  };

  const bindTerm = node => {
    if (node.dataset.glossaryBound === 'true') return;
    node.dataset.glossaryBound = 'true';
    node.setAttribute('role', 'button');
    node.setAttribute('tabindex', '0');
    node.setAttribute('aria-expanded', 'false');
    node.setAttribute('aria-label', `${node.textContent.trim()}，查看术语解释`);

    node.addEventListener('mouseenter', () => {
      if (HOVER_QUERY.matches && !pinned) openTooltip(node);
    });
    node.addEventListener('mouseleave', () => {
      if (HOVER_QUERY.matches && !pinned) scheduleClose(90);
    });
    node.addEventListener('focus', () => {
      if (node.matches(':focus-visible')) openTooltip(node);
    });
    node.addEventListener('blur', event => {
      if (tooltip && tooltip.contains(event.relatedTarget)) return;
      scheduleClose(60);
    });
    node.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if (activeTerm === node && pinned && tooltip?.classList.contains('is-visible')) closeTooltip();
      else openTooltip(node, true);
    });
    node.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeTooltip();
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (activeTerm === node && pinned && tooltip?.classList.contains('is-visible')) closeTooltip();
        else openTooltip(node, true);
      }
    });
  };

  const renderCollection = async container => {
    if (container.dataset.glossaryRendered === 'true') return;
    const collectionKey = container.dataset.glossaryCollection;

    try {
      const data = await loadData();
      const keys = data.collections?.[collectionKey] || [];
      const list = makeElement('dl', 'article-glossary-list');

      keys.forEach(key => {
        const term = data.terms?.[key];
        if (!term) return;
        const item = makeElement('div', 'article-glossary-list__item');
        const definition = makeElement('dd', '', term.definition);
        if (term.context) {
          definition.append(makeElement('span', 'article-glossary-list__context', term.context));
        }
        appendLinks(definition, term, 'article-glossary-list__links');
        item.append(makeElement('dt', '', term.label), definition);
        list.appendChild(item);
      });

      container.replaceChildren(list);
      container.dataset.glossaryRendered = 'true';
    } catch (error) {
      const status = makeElement('p', 'article-glossary-index__status', '术语数据暂时没有加载，请刷新页面重试。');
      container.replaceChildren(status);
      console.warn('[article-glossary] Unable to render glossary collection.', error);
    }
  };

  const init = () => {
    closeTooltip();
    document.querySelectorAll(TERM_SELECTOR).forEach(bindTerm);
    document.querySelectorAll(COLLECTION_SELECTOR).forEach(renderCollection);
  };

  document.addEventListener('click', event => {
    if (!activeTerm) return;
    if (activeTerm.contains(event.target) || tooltip?.contains(event.target)) return;
    closeTooltip();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeTooltip();
  });
  document.addEventListener('scroll', queuePosition, true);
  window.addEventListener('resize', queuePosition, { passive: true });
  document.addEventListener('pjax:complete', init);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
