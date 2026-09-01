(function () {
  'use strict';

  var palette;
  var input;
  var results;
  var searchEntries;
  var activeIndex = 0;

  var commands = [
    { title: '首页', subtitle: '最近更新', url: '/', icon: 'fa-home', keywords: 'home 首页 主页' },
    { title: '归档', subtitle: '时间索引', url: '/archives/', icon: 'fa-archive', keywords: 'archive archives 归档 文章' },
    { title: '索引', subtitle: '分类与标签', url: '/knowledge/', icon: 'fa-compass', keywords: 'knowledge categories tags 分类 标签 索引' },
    { title: '待办', subtitle: '未竟之事', url: '/todo/', icon: 'fa-check-square', keywords: 'todo task 任务 待办' }
  ];

  var categoryIcons = {
    '杂谈': { icon: 'fa-align-left', key: 'essay' },
    '科研': { icon: 'fa-microchip', key: 'research' },
    '开发': { icon: 'fa-code', key: 'dev' },
    '笔记': { icon: 'fa-book-open', key: 'notes' },
    'Hello World': { icon: 'fa-flag-checkered', key: 'milestone' },
    '竞赛': { icon: 'fa-medal', key: 'contest' }
  };

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function htmlToText(value) {
    var container = document.createElement('div');
    container.innerHTML = String(value || '');
    container.querySelectorAll('script, style').forEach(function (node) { node.remove(); });
    return clean(container.textContent);
  }

  function excerptAround(content, query) {
    if (!content) return '';
    var normalized = clean(query).toLowerCase();
    var match = normalized ? content.toLowerCase().indexOf(normalized) : -1;
    var start = match > 32 ? match - 32 : 0;
    var excerpt = content.slice(start, start + 118);
    return (start ? '…' : '') + excerpt + (start + excerpt.length < content.length ? '…' : '');
  }

  function highlightText(element, value, query) {
    if (!element) return;
    var text = String(value || '');
    var needle = clean(query);
    element.textContent = '';
    if (!needle) {
      element.textContent = text;
      return;
    }

    var lower = text.toLowerCase();
    var lowerNeedle = needle.toLowerCase();
    var cursor = 0;
    var match;
    while ((match = lower.indexOf(lowerNeedle, cursor)) !== -1) {
      if (match > cursor) element.appendChild(document.createTextNode(text.slice(cursor, match)));
      var mark = document.createElement('mark');
      mark.textContent = text.slice(match, match + needle.length);
      element.appendChild(mark);
      cursor = match + needle.length;
    }
    if (cursor < text.length) element.appendChild(document.createTextNode(text.slice(cursor)));
  }

  function categoryConfig(name) {
    return categoryIcons[clean(name)];
  }

  function createPalette() {
    palette = document.getElementById('ops-command-palette');
    if (!palette) {
      palette = document.createElement('div');
      palette.id = 'ops-command-palette';
      palette.hidden = true;
      palette.innerHTML = [
        '<button class="ops-command-backdrop" type="button" aria-label="关闭搜索"></button>',
        '<section class="ops-command-shell" role="dialog" aria-modal="true" aria-label="文章搜索">',
        '  <div class="ops-command-input-row">',
        '    <i class="fas fa-search" aria-hidden="true"></i>',
        '    <input id="ops-command-input" type="search" autocomplete="off" spellcheck="false" placeholder="搜索标题、正文、分类或标签">',
        '    <button class="ops-command-esc" type="button" aria-label="关闭搜索">ESC</button>',
        '  </div>',
        '  <div class="ops-command-results" role="listbox"></div>',
        '  <footer class="ops-command-footer"><span>COLIN / SEARCH</span></footer>',
        '</section>'
      ].join('');
      document.body.appendChild(palette);
      palette.querySelector('.ops-command-backdrop').addEventListener('click', closePalette);
      palette.querySelector('.ops-command-esc').addEventListener('click', closePalette);
    }

    input = palette.querySelector('#ops-command-input');
    results = palette.querySelector('.ops-command-results');
    if (input.dataset.opsBound !== 'true') {
      input.dataset.opsBound = 'true';
      input.addEventListener('input', function () {
        activeIndex = 0;
        renderResults(input.value);
      });
    }
  }

  function annotateCategories() {
    document.querySelectorAll('.card-category-list-link, .category-list-link').forEach(function (link) {
      if (link.dataset.opsCategory) return;
      var config = categoryConfig(link.textContent);
      if (!config) return;
      var icon = document.createElement('i');
      icon.className = 'fas ' + config.icon + ' ops-category-icon';
      icon.dataset.opsCategory = config.key;
      icon.setAttribute('aria-hidden', 'true');
      link.dataset.opsCategory = config.key;
      link.classList.add('ops-category-link');
      link.insertBefore(icon, link.firstChild);
    });
  }

  function annotateArticleCategories() {
    document.querySelectorAll('.article-meta__categories, a.post-meta-categories').forEach(function (link) {
      var config = categoryConfig(link.textContent);
      var parent = link.closest('.article-meta') || link.parentElement;
      if (!config || !parent || parent.dataset.opsCategoryReady === 'true') return;
      parent.dataset.opsCategoryReady = 'true';
      parent.querySelectorAll(':scope > .fa-inbox, :scope > .ops-article-category-icon').forEach(function (icon) {
        icon.remove();
      });
      var icon = document.createElement('i');
      icon.className = 'fas ' + config.icon + ' fa-fw post-meta-icon ops-article-category-icon';
      icon.dataset.opsCategory = config.key;
      icon.setAttribute('aria-hidden', 'true');
      parent.insertBefore(icon, link);
      link.dataset.opsCategory = config.key;
    });
  }

  function annotatePostTags() {
    if (!/^\/posts\//.test(window.location.pathname)) return;
    var meta = document.querySelector('#post-info .meta-firstline');
    if (!meta || meta.querySelector('.ops-post-tags')) return;
    loadSearchEntries().then(function (entries) {
      var entry = entries.find(function (item) {
        try {
          return new URL(item.url, window.location.origin).pathname === window.location.pathname;
        } catch (error) {
          return false;
        }
      });
      if (!entry || !entry.tags.length) return;
      var group = document.createElement('span');
      group.className = 'ops-post-tags';
      group.innerHTML = '<span class="post-meta-separator">|</span><i class="fas fa-tags fa-fw post-meta-icon" aria-hidden="true"></i>';
      entry.tags.forEach(function (tag) {
        var link = document.createElement('a');
        link.href = '/tags/' + encodeURIComponent(tag) + '/';
        link.textContent = '#' + tag;
        group.appendChild(link);
      });
      meta.appendChild(group);
    });
  }

  function annotatePage() {
    var path = window.location.pathname;
    var isTodo = /^\/todo\/?(?:index\.html)?$/.test(path);
    var isKnowledge = /^\/(?:knowledge|tags|categories)\/?(?:index\.html)?$/.test(path);
    var isLink = /^\/link\/?(?:index\.html)?$/.test(path);
    document.documentElement.classList.toggle('ops-page-todo', isTodo);
    document.documentElement.classList.toggle('ops-page-knowledge', isKnowledge);
    document.documentElement.classList.toggle('ops-page-link', isLink);
    document.documentElement.classList.toggle('ops-subpage', isTodo || isKnowledge || /^\/(?:link|archives)\//.test(path));
  }

  function parseSearchXml(xmlText) {
    var xml = new DOMParser().parseFromString(xmlText, 'text/xml');
    return Array.prototype.slice.call(xml.querySelectorAll('entry')).map(function (entry) {
      var title = clean(entry.querySelector('title') && entry.querySelector('title').textContent);
      var url = clean(entry.querySelector('url') && entry.querySelector('url').textContent);
      var content = htmlToText(entry.querySelector('content') && entry.querySelector('content').textContent);
      var categories = Array.prototype.slice.call(entry.querySelectorAll('categories > category')).map(function (node) {
        return clean(node.textContent);
      }).filter(Boolean);
      var tags = Array.prototype.slice.call(entry.querySelectorAll('tags > tag')).map(function (node) {
        return clean(node.textContent);
      }).filter(Boolean);
      var category = categories[0] || '';
      var config = categoryConfig(category);
      return {
        title: title,
        url: url,
        content: content,
        category: category,
        categories: categories,
        tags: tags,
        keywords: [title, content, categories.join(' '), tags.join(' ')].join(' ').toLowerCase(),
        icon: config ? config.icon : 'fa-file-alt',
        type: 'article'
      };
    }).filter(function (entry) { return entry.title && entry.url; });
  }

  function loadSearchEntries() {
    if (searchEntries) return Promise.resolve(searchEntries);
    if (!window.__COLIN_SEARCH_XML_PROMISE__) {
      window.__COLIN_SEARCH_XML_PROMISE__ = fetch('/search.xml', { credentials: 'same-origin' }).then(function (response) {
        if (!response.ok) throw new Error('Search index unavailable');
        return response.text();
      }).catch(function (error) {
        delete window.__COLIN_SEARCH_XML_PROMISE__;
        throw error;
      });
    }
    return window.__COLIN_SEARCH_XML_PROMISE__.then(function (xmlText) {
      searchEntries = parseSearchXml(xmlText);
      return searchEntries;
    }).catch(function () {
      searchEntries = [];
      return searchEntries;
    });
  }

  function itemMarkup(item, index) {
    var milestone = item.category === 'Hello World' ? ' is-milestone' : '';
    return [
      '<a class="ops-command-item' + (index === activeIndex ? ' is-active' : '') + milestone + '" role="option" href="' + item.url + '" data-index="' + index + '">',
      '  <span class="ops-command-icon"><i class="fas ' + item.icon + '" aria-hidden="true"></i></span>',
      '  <span class="ops-command-copy"><span class="ops-command-copy-top"><span class="ops-command-title"></span>',
      '  <span class="ops-command-category"></span></span><span class="ops-command-subtitle"></span></span>',
      '  <i class="fas fa-arrow-right ops-command-arrow" aria-hidden="true"></i>',
      '</a>'
    ].join('');
  }

  function paintItems(items, query) {
    if (!items.length) {
      results.innerHTML = '<div class="ops-command-empty">没有找到对应内容</div>';
      return;
    }
    results.innerHTML = items.map(itemMarkup).join('');
    results.querySelectorAll('.ops-command-item').forEach(function (element, index) {
      var item = items[index];
      highlightText(element.querySelector('.ops-command-title'), item.title, query);
      highlightText(element.querySelector('.ops-command-subtitle'), item.subtitle || '', query);
      var category = element.querySelector('.ops-command-category');
      category.textContent = item.category || '';
      category.hidden = !item.category;
      element.addEventListener('mouseenter', function () {
        activeIndex = index;
        updateActiveItem();
      });
    });
  }

  function renderResults(query) {
    var normalized = clean(query).toLowerCase();
    if (!normalized) {
      paintItems(commands, '');
      return;
    }
    loadSearchEntries().then(function (entries) {
      var filtered = commands.concat(entries).filter(function (item) {
        return [item.title, item.subtitle, item.keywords].join(' ').toLowerCase().indexOf(normalized) !== -1;
      }).map(function (item) {
        if (item.type !== 'article') return item;
        return Object.assign({}, item, { subtitle: excerptAround(item.content, normalized) });
      }).slice(0, 10);
      activeIndex = Math.min(activeIndex, Math.max(filtered.length - 1, 0));
      paintItems(filtered, normalized);
    });
  }

  function updateActiveItem() {
    var items = results.querySelectorAll('.ops-command-item');
    items.forEach(function (item, index) { item.classList.toggle('is-active', index === activeIndex); });
    if (items[activeIndex]) items[activeIndex].scrollIntoView({ block: 'nearest' });
  }

  function openPalette() {
    createPalette();
    palette.hidden = false;
    document.body.classList.add('ops-palette-open');
    activeIndex = 0;
    input.value = '';
    renderResults('');
    window.setTimeout(function () { input.focus(); }, 30);
  }

  function closePalette() {
    if (!palette) return;
    palette.hidden = true;
    document.body.classList.remove('ops-palette-open');
  }

  function bindSearchTrigger() {
    var trigger = document.querySelector('#search-button a, #search-button .site-page');
    if (!trigger || trigger.dataset.opsBound === 'true') return;
    trigger.dataset.opsBound = 'true';
    trigger.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openPalette();
    }, true);
  }

  function handleKeyboard(event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openPalette();
      return;
    }
    if (!palette || palette.hidden) return;
    var items = results.querySelectorAll('.ops-command-item');
    if (event.key === 'Escape') {
      event.preventDefault();
      closePalette();
    } else if (event.key === 'ArrowDown' && items.length) {
      event.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      updateActiveItem();
    } else if (event.key === 'ArrowUp' && items.length) {
      event.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      updateActiveItem();
    } else if (event.key === 'Enter' && items[activeIndex]) {
      event.preventDefault();
      items[activeIndex].click();
    }
  }

  function initialize() {
    createPalette();
    annotatePage();
    annotateCategories();
    annotateArticleCategories();
    annotatePostTags();
    bindSearchTrigger();
  }

  document.addEventListener('keydown', handleKeyboard);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
  document.addEventListener('pjax:complete', initialize);
}());
