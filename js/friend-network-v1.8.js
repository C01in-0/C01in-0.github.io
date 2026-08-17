(function () {
  'use strict';

  function hostFromLink(link) {
    try {
      return new URL(link, window.location.origin).hostname.replace(/^www\./, '');
    } catch (error) {
      return 'external-node';
    }
  }

  function drawRoute(article, cards) {
    var svg = article.querySelector('.ops-peer-routes');
    if (!svg || !cards.length) return;
    var articleBounds = article.getBoundingClientRect();
    var points = cards.map(function (card) {
      var bounds = card.getBoundingClientRect();
      return {
        x: bounds.left - articleBounds.left + bounds.width / 2,
        y: bounds.top - articleBounds.top + bounds.height / 2
      };
    });
    var hero = article.querySelector('.ops-peer-hero');
    var heroBounds = hero.getBoundingClientRect();
    points.unshift({
      x: heroBounds.left - articleBounds.left + Math.min(heroBounds.width * 0.2, 150),
      y: heroBounds.bottom - articleBounds.top - 4
    });
    svg.setAttribute('viewBox', '0 0 ' + Math.max(article.scrollWidth, 1) + ' ' + Math.max(article.scrollHeight, 1));
    svg.innerHTML = points.slice(1).map(function (point, index) {
      var previous = points[index];
      var bend = Math.max(32, Math.abs(point.y - previous.y) * 0.34);
      var path = 'M ' + previous.x.toFixed(1) + ' ' + previous.y.toFixed(1) +
        ' C ' + previous.x.toFixed(1) + ' ' + (previous.y + bend).toFixed(1) + ', ' +
        point.x.toFixed(1) + ' ' + (point.y - bend).toFixed(1) + ', ' + point.x.toFixed(1) + ' ' + point.y.toFixed(1);
      return '<path class="ops-peer-route" data-segment="' + index + '" pathLength="1" d="' + path + '"></path>' +
        '<circle class="ops-peer-route-node" cx="' + point.x.toFixed(1) + '" cy="' + point.y.toFixed(1) + '" r="4"></circle>';
    }).join('');
  }

  function initialize() {
    if (!/^\/link\/?(?:index\.html)?$/.test(window.location.pathname)) return;
    var article = document.querySelector('#article-container') || document.querySelector('#page');
    if (!article || article.dataset.opsPeerVersion === '1.8') return;
    var cards = Array.prototype.slice.call(article.querySelectorAll('.flink-list-item'));
    if (!cards.length) return;
    article.dataset.opsPeerVersion = '1.8';

    var hero = document.createElement('header');
    hero.className = 'ops-peer-hero';
    hero.innerHTML = [
      '<div><span class="ops-peer-kicker">PEER NETWORK</span>',
      '<h2>与君相逢，实属荣幸</h2></div>',
      '<div class="ops-peer-stat"><strong>' + cards.length + '</strong><span>NODES</span></div>'
    ].join('');
    article.insertBefore(hero, article.firstChild);

    var routes = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    routes.setAttribute('class', 'ops-peer-routes');
    routes.setAttribute('aria-hidden', 'true');
    article.insertBefore(routes, hero.nextSibling);

    cards.forEach(function (card, index) {
      var link = card.querySelector('a[href]');
      if (!link) return;
      card.classList.add('ops-peer-card');
      card.style.setProperty('--peer-index', index);
      var meta = document.createElement('span');
      meta.className = 'ops-peer-meta';
      meta.innerHTML = '<span class="ops-peer-seq">NODE ' + String(index + 1).padStart(2, '0') + '</span>' +
        '<span class="ops-peer-host">' + hostFromLink(link.href) + '</span>';
      link.appendChild(meta);
      function showRoute() {
        article.classList.add('is-peer-exploring');
        card.classList.add('is-peer-focus');
        var segment = article.querySelector('.ops-peer-route[data-segment="' + index + '"]');
        if (segment) segment.classList.add('is-peer-focus');
      }
      function hideRoute() {
        article.classList.remove('is-peer-exploring');
        card.classList.remove('is-peer-focus');
        article.querySelectorAll('.ops-peer-route.is-peer-focus').forEach(function (path) { path.classList.remove('is-peer-focus'); });
      }
      card.addEventListener('pointerenter', showRoute);
      card.addEventListener('pointerleave', hideRoute);
      link.addEventListener('focus', showRoute);
      link.addEventListener('blur', hideRoute);
      card.addEventListener('pointermove', function (event) {
        var bounds = card.getBoundingClientRect();
        card.style.setProperty('--peer-x', ((event.clientX - bounds.left) / bounds.width * 100).toFixed(1) + '%');
        card.style.setProperty('--peer-y', ((event.clientY - bounds.top) / bounds.height * 100).toFixed(1) + '%');
      });
    });

    var redrawFrame = 0;
    function scheduleRoute() {
      window.cancelAnimationFrame(redrawFrame);
      redrawFrame = window.requestAnimationFrame(function () { drawRoute(article, cards); });
    }
    if ('ResizeObserver' in window) new ResizeObserver(scheduleRoute).observe(article);
    window.addEventListener('resize', scheduleRoute, { passive: true });
    window.setTimeout(scheduleRoute, 80);
    window.requestAnimationFrame(function () {
      cards.forEach(function (card) { card.classList.add('is-peer-ready'); });
      article.classList.add('is-peer-ready');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
  document.addEventListener('pjax:complete', initialize);
}());
