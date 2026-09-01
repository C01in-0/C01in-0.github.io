'use strict';

function listValues(value) {
  if (!value) return [];
  if (typeof value.toArray === 'function') return value.toArray().map(item => item.name || String(item));
  return (Array.isArray(value) ? value : [value]).map(item => String(item).trim()).filter(Boolean);
}

function compactHtml(value) {
  return String(value || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function rootedUrl(root, postPath) {
  const prefix = `/${String(root || '/').replace(/^\/+|\/+$/g, '')}`.replace(/\/$/, '');
  return `${prefix}/${String(postPath || '').replace(/^\/+/, '')}`.replace(/\/{2,}/g, '/');
}

hexo.extend.generator.register('knowledge-index', locals => {
  const posts = locals.posts
    .filter(post => post.published !== false)
    .sort('-date')
    .map(post => ({
      title: String(post.title || '').trim(),
      url: rootedUrl(hexo.config.root, post.path),
      content: compactHtml(post.content || post._content),
      categories: listValues(post.categories),
      tags: listValues(post.tags),
      knowledge: listValues(post.knowledge)
    }));

  return {
    path: 'data/knowledge-index-v1.json',
    data: JSON.stringify({ version: 1, posts })
  };
});
