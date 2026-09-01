'use strict';

hexo.extend.generator.register('ops-data', function () {
  var data = hexo.locals.get('data') || {};
  return {
    path: 'data/todo.json',
    data: JSON.stringify(data.todo || {}, null, 2)
  };
});
