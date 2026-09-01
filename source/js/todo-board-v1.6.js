(function () {
  'use strict';

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function stats(data) {
    var total = 0;
    var complete = 0;
    (data.groups || []).forEach(function (group) {
      (group.items || []).forEach(function (item) {
        total += 1;
        if (item.done) complete += 1;
      });
    });
    return { total: total, complete: complete };
  }

  function groupMarkup(group, index) {
    var complete = (group.items || []).filter(function (item) { return item.done; }).length;
    var unfinishedItems = (group.items || []).filter(function (item) { return !item.done; });
    var completedItems = (group.items || []).filter(function (item) { return item.done; });
    var orderedItems = unfinishedItems.concat(completedItems);
    return [
      '<section class="ops-quest-lane" style="--lane-index:' + index + '">',
      '<header><div><span>' + escapeHtml(group.code || 'QUEST') + '</span><h3>' + escapeHtml(group.name) + '</h3></div>',
      '<strong>' + complete + '<small> / ' + (group.items || []).length + '</small></strong></header><ul>',
      orderedItems.map(function (item, itemIndex) {
        var beginsCompletedGroup = item.done && itemIndex === unfinishedItems.length && unfinishedItems.length;
        return [
          '<li class="' + (item.done ? 'is-complete' : '') + (beginsCompletedGroup ? ' is-first-complete' : '') + '">',
          '<span class="ops-quest-check" role="img" aria-label="' + (item.done ? '已完成' : '未完成') + '"></span>',
          '<span class="ops-quest-text">' + escapeHtml(item.text) + '</span></li>'
        ].join('');
      }).join(''),
      '</ul></section>'
    ].join('');
  }

  function render(root, data) {
    var progress = stats(data);
    var percent = progress.total ? Math.round(progress.complete / progress.total * 100) : 0;
    var title = data.title || '直到未竟之事，成为已行之路';
    var quote = data.quote || '余虽不敏，亦望卒有所获';
    root.innerHTML = [
      '<section class="ops-quest-board" aria-label="只读待办清单">',
      '<header class="ops-quest-hero"><div class="ops-quest-heading">',
      '<h2>' + escapeHtml(title) + '</h2><p>' + escapeHtml(quote) + '</p></div>',
      '<div class="ops-quest-stat" aria-label="已完成 ' + progress.complete + ' 项，共 ' + progress.total + ' 项">',
      '<strong>' + progress.complete + '<small> / ' + progress.total + '</small></strong></div>',
      '<div class="ops-quest-progress"><span style="--quest-progress:' + percent + '%"></span></div></header>',
      '<div class="ops-quest-grid">' + (data.groups || []).map(groupMarkup).join('') + '</div></section>'
    ].join('');
    var board = root.querySelector('.ops-quest-board');
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () { board.classList.add('is-ready'); });
    });
  }

  function initialize() {
    if (!/^\/todo\/?(?:index\.html)?$/.test(window.location.pathname)) return;
    var root = document.getElementById('ops-todo-root');
    if (!root || root.dataset.opsTodoReady === 'true') return;
    root.dataset.opsTodoReady = 'true';
    fetch('/data/todo.json', { credentials: 'same-origin' }).then(function (response) {
      if (!response.ok) throw new Error('Todo data unavailable');
      return response.json();
    }).then(function (data) {
      render(root, data);
    }).catch(function () {
      root.innerHTML = '<div class="ops-module-error"><strong>待办数据暂时不可用</strong></div>';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();
  document.addEventListener('pjax:complete', initialize);
}());
