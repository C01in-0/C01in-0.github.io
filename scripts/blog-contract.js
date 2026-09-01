'use strict';

const fs = require('fs');
const path = require('path');
const frontMatter = require('hexo-front-matter');

const postsDir = path.join(hexo.base_dir, 'source', '_posts');
const imagesDir = path.join(hexo.base_dir, 'source', 'images');

function fail(message) {
  throw new Error(`[blog-contract] ${message}`);
}

function readPost(fileName) {
  const fullPath = path.join(postsDir, fileName);
  const source = fs.readFileSync(fullPath, 'utf8');
  const data = frontMatter.parse(source);
  const blogId = Number(data.blog_id);
  const date = new Date(data.date);

  if (!Number.isInteger(blogId) || blogId < 1) {
    fail(`${fileName} is missing a positive integer blog_id`);
  }
  if (Number.isNaN(date.getTime())) {
    fail(`${fileName} has an invalid date`);
  }

  return { fileName, fullPath, source, blogId, date };
}

function validateIds(posts) {
  const seen = new Map();
  posts.forEach(post => {
    if (seen.has(post.blogId)) {
      fail(`duplicate blog_id ${post.blogId}: ${seen.get(post.blogId)} and ${post.fileName}`);
    }
    seen.set(post.blogId, post.fileName);
  });

  posts
    .slice()
    .sort((left, right) => left.date - right.date)
    .forEach((post, index) => {
      const expected = index + 1;
      if (post.blogId !== expected) {
        fail(`${post.fileName} is blog_id ${post.blogId}, but chronological order requires ${expected}`);
      }
    });
}

function validateImages(posts) {
  const imagePattern = /!\[[^\]]*\]\((\/images\/[^)\s]+)\)/g;

  posts.forEach(post => {
    const expectedPrefix = `/images/blog${post.blogId}/`;
    let match;
    while ((match = imagePattern.exec(post.source)) !== null) {
      const imageUrl = match[1];
      if (!imageUrl.startsWith(expectedPrefix)) {
        fail(`${post.fileName} uses ${imageUrl}; expected ${expectedPrefix}`);
      }

      const relativePath = decodeURI(imageUrl).replace(/^\/+/, '').replace(/\//g, path.sep);
      const diskPath = path.join(hexo.base_dir, 'source', relativePath);
      if (!fs.existsSync(diskPath)) {
        fail(`${post.fileName} references missing image ${imageUrl}`);
      }
    }
  });

  fs.readdirSync(imagesDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.toLowerCase().startsWith('blog'))
    .forEach(entry => {
      if (!/^blog\d+$/.test(entry.name)) {
        fail(`legacy article image directory remains: source/images/${entry.name}`);
      }
    });
}

hexo.extend.filter.register('before_generate', () => {
  const posts = fs.readdirSync(postsDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .map(entry => readPost(entry.name));

  validateIds(posts);
  validateImages(posts);
  hexo.log.info(`[blog-contract] verified ${posts.length} chronological blog IDs and image paths`);
});
