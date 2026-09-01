'use strict';

const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const baseUrl = process.env.BLOG_QA_URL || 'http://127.0.0.1:4032';
const outputDir = process.env.BLOG_QA_OUTPUT || path.join(process.cwd(), 'qa', 'release');
const chromePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const articlePaths = [
  '/posts/8f78ec30.html',
  '/posts/2bd895ae.html',
  '/posts/f4b0bc56.html',
  '/posts/ef9d0362.html'
];

function listAllArticlePaths() {
  const postsDir = path.join(process.cwd(), 'public', 'posts');
  if (!fsSync.existsSync(postsDir)) return [];
  return fsSync.readdirSync(postsDir)
    .filter(name => name.endsWith('.html'))
    .sort()
    .map(name => `/posts/${name}`);
}

const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 }
];

async function settle(page) {
  await page.evaluate(async () => {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    if (document.fonts && document.fonts.ready) {
      await Promise.race([document.fonts.ready, wait(2500)]);
    }
    document.querySelectorAll('img').forEach(image => { image.loading = 'eager'; });
    await Promise.race([
      Promise.all([...document.images].map(async image => {
        if (image.complete && image.naturalWidth > 0) return;
        try { await image.decode(); } catch {}
      })),
      wait(4000)
    ]);
  });
  await page.waitForTimeout(220);
}

async function inspect(page) {
  return page.evaluate(() => {
    const title = document.querySelector('#post-info .post-title');
    const paginationItems = [...document.querySelectorAll('#pagination .pagination > *:not(.space)')];
    const styleOf = element => {
      if (!element) return null;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        width: Number(rect.width.toFixed(1)),
        height: Number(rect.height.toFixed(1)),
        background: style.background,
        borderColor: style.borderColor,
        borderTopWidth: style.borderTopWidth,
        borderBottomWidth: style.borderBottomWidth,
        borderRadius: style.borderRadius,
        backgroundImage: style.backgroundImage,
        backgroundColor: style.backgroundColor,
        color: style.color,
        boxShadow: style.boxShadow,
        backdropFilter: style.backdropFilter || style.webkitBackdropFilter
      };
    };

    return {
      path: location.pathname,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      brokenImages: [...document.images]
        .filter(image => image.complete && image.naturalWidth === 0)
        .map(image => image.currentSrc || image.src),
      logs: [...document.querySelectorAll('#recent-posts .recent-post-item')]
        .map(card => card.getAttribute('data-ops-index')),
      title: title ? {
        text: title.textContent.trim(),
        clientHeight: title.clientHeight,
        scrollHeight: title.scrollHeight,
        clipped: title.scrollHeight > title.clientHeight + 1
      } : null,
      glossaryTerms: document.querySelectorAll('.glossary-term').length,
      glossaryCollections: document.querySelectorAll('[data-glossary-collection]').length,
      pagination: {
        count: paginationItems.length,
        container: styleOf(document.querySelector('#pagination .pagination')),
        regular: styleOf(paginationItems.find(item => !item.classList.contains('current'))),
        current: styleOf(document.querySelector('#pagination .page-number.current'))
      }
    };
  });
}

async function capturePagination(page, viewportName, theme) {
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.evaluate(selectedTheme => document.documentElement.setAttribute('data-theme', selectedTheme), theme);
  const pagination = page.locator('#pagination .pagination');
  await pagination.scrollIntoViewIfNeeded();
  await page.waitForTimeout(180);
  await pagination.screenshot({ path: path.join(outputDir, `pagination-${viewportName}-${theme}.png`) });
}

async function inspectTocAfterDeferredImages(page) {
  await page.goto(`${baseUrl}/posts/ef9d0362.html`, { waitUntil: 'load' });
  for (let step = 0; step < 24; step += 1) {
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(90);
    const reached = await page.evaluate(() => [...document.querySelectorAll('#article-container h3')]
      .find(node => node.textContent.includes('Injection Identifier'))
      ?.getBoundingClientRect().top < 300);
    if (reached) break;
  }
  await page.evaluate(() => {
    const target = [...document.querySelectorAll('#article-container h3')]
      .find(node => node.textContent.includes('Injection Identifier'));
    window.scrollTo(0, target.getBoundingClientRect().top + window.scrollY - 60);
  });
  await page.waitForTimeout(500);
  return page.evaluate(() => ({
    active: document.querySelector('#card-toc .toc-link.active')?.textContent.trim() || '',
    visibleHeading: [...document.querySelectorAll('#article-container h1,#article-container h2,#article-container h3')]
      .filter(node => node.getBoundingClientRect().top < 90)
      .at(-1)?.textContent.trim() || '',
    loadedImages: [...document.images].filter(image => image.complete && image.naturalWidth > 0).length,
    totalImages: document.images.length
  }));
}

async function inspectKnowledgeAtlas(page, viewportName) {
  const response = await page.goto(`${baseUrl}/knowledge/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.atlas-v2.is-ready');
  const compact = viewportName === 'mobile';
  const overview = await page.evaluate(() => {
    const nodeSelector = matchMedia('(max-width: 900px)').matches ? '.atlas-v2__mobile-node' : '.atlas-v2__node';
    const nodes = [...document.querySelectorAll(nodeSelector)].map(node => ({
      tag: node.dataset.tag,
      count: Number((node.querySelector('.atlas-v2__count') || node.querySelector('b'))?.textContent.trim() || 0),
      box: node.getBoundingClientRect().toJSON()
    }));
    const overlaps = [];
    if (!matchMedia('(max-width: 900px)').matches) {
      for (let left = 0; left < nodes.length; left += 1) {
        for (let right = left + 1; right < nodes.length; right += 1) {
          const a = nodes[left].box;
          const b = nodes[right].box;
          const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (overlapX > 2 && overlapY > 2) overlaps.push(`${nodes[left].tag}/${nodes[right].tag}`);
        }
      }
    }
    return { nodes, overlaps };
  });
  if (!compact) {
    const overviewCanvas = page.locator('.atlas-v2__canvas');
    await overviewCanvas.screenshot({ path: path.join(outputDir, 'atlas-overview-light.png') });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await page.waitForTimeout(180);
    await overviewCanvas.screenshot({ path: path.join(outputDir, 'atlas-overview-dark.png') });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    await page.waitForTimeout(180);
  }
  const selector = compact
    ? '.atlas-v2__mobile-node[data-tag="ai-security"]'
    : '.atlas-v2__node[data-tag="ai-security"]';
  await page.locator(selector).click();
  await page.waitForTimeout(compact ? 300 : 900);

  const result = await page.evaluate(() => {
    const nodeSelector = matchMedia('(max-width: 900px)').matches ? '.atlas-v2__mobile-node' : '.atlas-v2__node';
    const nodes = [...document.querySelectorAll(nodeSelector)].map(node => ({
      tag: node.dataset.tag,
      title: node.getAttribute('title') || node.querySelector('title')?.textContent || '',
      box: node.getBoundingClientRect().toJSON()
    }));
    const overlaps = [];
    if (!matchMedia('(max-width: 900px)').matches) {
      for (let left = 0; left < nodes.length; left += 1) {
        for (let right = left + 1; right < nodes.length; right += 1) {
          const a = nodes[left].box;
          const b = nodes[right].box;
          const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (overlapX > 2 && overlapY > 2) overlaps.push(`${nodes[left].tag}/${nodes[right].tag}`);
        }
      }
    }
    return {
      status: document.querySelector('.atlas-v2.is-ready') ? 'ready' : 'not-ready',
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      tags: nodes.map(node => node.tag),
      missingTitles: nodes.filter(node => !node.title).map(node => node.tag),
      overlaps
    };
  });
  result.httpStatus = response ? response.status() : null;
  result.viewport = viewportName;
  result.overview = overview.nodes;
  result.overviewOverlaps = overview.overlaps;
  result.zeroCountRoots = overview.nodes.filter(node => node.count === 0).map(node => node.tag);

  if (!compact) {
    const canvas = page.locator('.atlas-v2__canvas');
    await canvas.screenshot({ path: path.join(outputDir, 'atlas-ai-four-axis-light.png') });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await page.waitForTimeout(180);
    await canvas.screenshot({ path: path.join(outputDir, 'atlas-ai-four-axis-dark.png') });
    const hoverNode = page.locator('.atlas-v2__node[data-tag="ai-systems"]');
    if (await hoverNode.count()) {
      await hoverNode.hover();
      await page.waitForTimeout(140);
      result.emphasizedEdgesOnHover = await page.locator('.atlas-v2__edge.is-emphasized').count();
      const canvasBox = await canvas.boundingBox();
      await page.mouse.move(canvasBox.x + 8, canvasBox.y + 8);
      await page.waitForTimeout(190);
      result.emphasizedEdgesAfterLeave = await page.locator('.atlas-v2__edge.is-emphasized').count();
    }
  }
  return result;
}

async function inspectLiquidNavExit(page) {
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  const menus = page.locator('#nav #menus');
  const box = await menus.boundingBox();
  const read = () => menus.evaluate(element => ({
    x: element.style.getPropertyValue('--ops-liquid-x'),
    bend: element.style.getPropertyValue('--ops-liquid-bend'),
    active: element.classList.contains('is-liquid-active'),
    opacity: Number(getComputedStyle(element, '::after').opacity),
    backgroundImage: getComputedStyle(element).backgroundImage,
    backgroundColor: getComputedStyle(element).backgroundColor,
    borderColor: getComputedStyle(element).borderColor,
    boxShadow: getComputedStyle(element).boxShadow,
    topLightOpacity: Number(getComputedStyle(element, '::before').opacity)
  }));
  const idle = await read();
  await page.mouse.move(box.x + 48, box.y + box.height / 2);
  await page.waitForTimeout(120);
  const inside = await read();
  await menus.screenshot({ path: path.join(outputDir, 'liquid-nav-active-left.png') });
  await page.mouse.move(box.x - 30, box.y + box.height + 80);
  await page.waitForTimeout(80);
  const fading = await read();
  await page.waitForTimeout(220);
  const hidden = await read();
  await menus.screenshot({ path: path.join(outputDir, 'liquid-nav-idle-after-left.png') });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.waitForTimeout(120);
  const dark = await read();
  await menus.screenshot({ path: path.join(outputDir, 'liquid-nav-idle-dark.png') });
  return { idle, inside, fading, hidden, dark };
}

async function inspectStickyTitleExit(page) {
  await page.goto(`${baseUrl}/posts/ef9d0362.html`, { waitUntil: 'networkidle' });
  const read = label => page.evaluate(label => {
    const title = document.querySelector('#nav .nav-page-title > .site-name:first-child');
    const info = document.querySelector('#nav #blog-info');
    const titleStyle = getComputedStyle(title);
    const titleBox = title.getBoundingClientRect();
    const infoBox = info.getBoundingClientRect();
    return {
      label,
      headerClasses: document.querySelector('#page-header').className,
      titleWidth: Number(titleBox.width.toFixed(2)),
      titleHeight: Number(titleBox.height.toFixed(2)),
      infoWidth: Number(infoBox.width.toFixed(2)),
      fontSize: titleStyle.fontSize,
      lineHeight: titleStyle.lineHeight,
      titleShadow: titleStyle.textShadow,
      titleShadowLayers: (titleStyle.textShadow.match(/rgba?\(/g) || []).length
    };
  }, label);

  await page.evaluate(() => scrollTo(0, 180));
  await page.waitForTimeout(360);
  await page.evaluate(() => scrollTo(0, 80));
  await page.waitForTimeout(360);
  const fixed = await read('fixed-80');
  await page.locator('#nav').screenshot({ path: path.join(outputDir, 'sticky-title-fixed.png') });
  const exitFrames = await page.evaluate(async () => {
    const frames = [];
    const startedAt = performance.now();
    await new Promise(resolve => {
      const sample = () => {
        const title = document.querySelector('#nav .nav-page-title');
        const titleStyle = getComputedStyle(title);
        frames.push({
          elapsed: Number((performance.now() - startedAt).toFixed(1)),
          scrollY,
          rootClasses: document.documentElement.className,
          headerClasses: document.querySelector('#page-header').className,
          titleDisplay: titleStyle.display,
          titleOpacity: titleStyle.opacity
        });
        if (performance.now() - startedAt < 420) requestAnimationFrame(sample);
        else resolve();
      };
      scrollTo(0, 40);
      requestAnimationFrame(sample);
    });
    return frames;
  });
  const nearTop = await read('near-top-40');
  await page.locator('#nav').screenshot({ path: path.join(outputDir, 'sticky-title-near-top.png') });
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(360);
  const settled = await read('settled-top');
  return {
    fixed,
    nearTop,
    exitFrames,
    arrivalObserved: exitFrames.some(frame => frame.rootClasses.includes('ops-nav-arriving')),
    settled
  };
}

async function inspectArticleSurfaceOpacity(page) {
  await page.goto(`${baseUrl}/posts/ef9d0362.html`, { waitUntil: 'networkidle' });
  await settle(page);
  const read = () => page.locator('#post').evaluate(element => {
    const color = getComputedStyle(element).backgroundColor;
    const match = color.match(/^rgba?\(([^)]+)\)$/);
    const parts = match ? match[1].split(',').map(value => Number(value.trim())) : [];
    const paragraph = element.querySelector('p') || element;
    const selectionStyle = getComputedStyle(paragraph, '::selection');
    return {
      color,
      alpha: parts.length === 4 ? parts[3] : 1,
      selectionBackground: selectionStyle.backgroundColor,
      selectionColor: selectionStyle.color
    };
  });
  const light = await read();
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.waitForTimeout(100);
  const dark = await read();
  return { light, dark };
}

async function inspectDarkArticleImage(page) {
  await page.goto(`${baseUrl}/posts/ef9d0362.html`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  const image = page.locator('#article-container img[src*="paper-figure-3-pooling"]');
  await image.scrollIntoViewIfNeeded();
  await page.waitForTimeout(620);
  const read = () => image.evaluate(element => {
    const style = getComputedStyle(element);
    const brightness = Number(style.filter.match(/brightness\(([^)]+)\)/)?.[1] || 1);
    return { filter: style.filter, brightness, transform: style.transform, boxShadow: style.boxShadow };
  });
  const resting = await read();
  await image.screenshot({ path: path.join(outputDir, 'article-white-figure-dark-rest.png') });
  await image.hover();
  await page.waitForTimeout(620);
  const hovering = await read();
  await image.screenshot({ path: path.join(outputDir, 'article-white-figure-dark-hover.png') });
  return { resting, hovering };
}

async function inspectAllArticleTocAlignment(page) {
  const results = [];
  for (const targetPath of listAllArticlePaths()) {
    const response = await page.goto(`${baseUrl}${targetPath}`, { waitUntil: 'networkidle' });
    await settle(page);
    const structure = await page.evaluate(() => {
      const headings = [...document.querySelectorAll('#article-container h1,#article-container h2,#article-container h3,#article-container h4,#article-container h5,#article-container h6')]
        .filter(heading => heading.id)
        .map((heading, index) => ({ id: heading.id, text: heading.textContent.trim(), index }));
      const links = [...document.querySelectorAll('#card-toc .toc-link')].map((link, index) => ({
        href: decodeURI(link.getAttribute('href') || '').replace(/^#/, ''),
        text: link.textContent.trim(),
        index
      }));
      return { headings, links };
    });
    const structureMismatches = structure.headings
      .filter((heading, index) => structure.links[index]?.href !== heading.id)
      .map(heading => heading.text);
    const activeMismatches = [];
    for (const heading of structure.headings) {
      const state = await page.evaluate(id => {
        const headings = [...document.querySelectorAll('#article-container h1,#article-container h2,#article-container h3,#article-container h4,#article-container h5,#article-container h6')]
          .filter(node => node.id)
          .map(node => ({ node, top: node.getBoundingClientRect().top + scrollY }));
        const target = headings.find(item => item.node.id === id);
        scrollTo(0, Math.max(1, target.top - 20));
        return true;
      }, heading.id);
      if (!state) continue;
      await page.waitForTimeout(180);
      const alignment = await page.evaluate(() => {
        const currentTop = scrollY;
        const headings = [...document.querySelectorAll('#article-container h1,#article-container h2,#article-container h3,#article-container h4,#article-container h5,#article-container h6')]
          .filter(node => node.id)
          .map(node => ({ id: node.id, top: node.getBoundingClientRect().top + currentTop }));
        const expected = headings.filter(item => currentTop > item.top - 80).at(-1)?.id || '';
        const active = decodeURI(document.querySelector('#card-toc .toc-link.active')?.getAttribute('href') || '').replace(/^#/, '');
        return { expected, active, scrollY: currentTop };
      });
      if (alignment.expected !== alignment.active) activeMismatches.push({ heading: heading.text, ...alignment });
    }
    results.push({
      path: targetPath,
      status: response ? response.status() : null,
      headingCount: structure.headings.length,
      tocCount: structure.links.length,
      structureMismatches,
      activeMismatches
    });
  }
  return results;
}

async function inspectArticleCategoryIcons(page) {
  await page.goto(`${baseUrl}/posts/ef9d0362.html`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.locator('#post-meta .meta-firstline').screenshot({ path: path.join(outputDir, 'article-dual-category-icons.png') });
  return page.evaluate(() => [...document.querySelectorAll('#post-info a.post-meta-categories')].map(link => {
    const icon = link.previousElementSibling;
    return {
      category: link.textContent.trim(),
      iconClass: icon && icon.classList.contains('ops-article-category-icon') ? icon.className : '',
      iconCategory: icon && icon.dataset ? icon.dataset.opsCategory || '' : ''
    };
  }));
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const launchOptions = { headless: true };
  if (chromePath && fsSync.existsSync(chromePath)) launchOptions.executablePath = chromePath;
  const browser = await chromium.launch(launchOptions);
  const report = { baseUrl, generatedAt: new Date().toISOString(), cases: [], knowledge: [], pjax: null, failures: [] };

  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();

      for (const targetPath of ['/', '/page/2/', ...articlePaths]) {
        const response = await page.goto(`${baseUrl}${targetPath}`, { waitUntil: 'networkidle' });
        await settle(page);
        const result = await inspect(page);
        result.viewport = viewport.name;
        result.status = response ? response.status() : null;
        report.cases.push(result);

        if (result.status !== 200) report.failures.push(`${viewport.name} ${targetPath} returned ${result.status}`);
        if (result.horizontalOverflow) report.failures.push(`${viewport.name} ${targetPath} has horizontal overflow`);
        if (result.brokenImages.length) report.failures.push(`${viewport.name} ${targetPath} has broken images`);
        if (result.title && result.title.clipped) report.failures.push(`${viewport.name} ${targetPath} clips its title`);
        if (result.pagination.regular && result.pagination.regular.backgroundColor !== 'rgba(0, 0, 0, 0)') {
          report.failures.push(`${viewport.name} ${targetPath} pagination reverted to tile backgrounds`);
        }
        if (result.pagination.regular && result.pagination.regular.boxShadow !== 'none') {
          report.failures.push(`${viewport.name} ${targetPath} pagination reverted to detached shadows`);
        }
        if (result.pagination.container && (result.pagination.container.backgroundImage !== 'none'
          || result.pagination.container.borderTopWidth !== '0px'
          || result.pagination.container.borderBottomWidth !== '0px'
          || result.pagination.container.backdropFilter !== 'none')) {
          report.failures.push(`${viewport.name} ${targetPath} pagination reverted to a visible carrier band`);
        }
      }

      const knowledge = await inspectKnowledgeAtlas(page, viewport.name);
      report.knowledge.push(knowledge);
      const expectedAxes = ['ai-security', 'ai-threats', 'ai-defenses', 'ai-systems', 'ai-mechanisms'];
      const missingAxes = expectedAxes.filter(tag => !knowledge.tags.includes(tag));
      if (knowledge.httpStatus !== 200 || knowledge.status !== 'ready') report.failures.push(`${viewport.name} knowledge atlas failed to load`);
      if (knowledge.horizontalOverflow) report.failures.push(`${viewport.name} knowledge atlas has horizontal overflow`);
      if (knowledge.overlaps.length) report.failures.push(`${viewport.name} knowledge atlas overlaps ${knowledge.overlaps.join(', ')}`);
      if (knowledge.overviewOverlaps.length) report.failures.push(`${viewport.name} knowledge overview overlaps ${knowledge.overviewOverlaps.join(', ')}`);
      if (missingAxes.length) report.failures.push(`${viewport.name} knowledge atlas misses ${missingAxes.join(', ')}`);
      if (knowledge.missingTitles.length) report.failures.push(`${viewport.name} knowledge nodes miss full labels: ${knowledge.missingTitles.join(', ')}`);
      if (knowledge.zeroCountRoots.length) report.failures.push(`${viewport.name} knowledge overview shows zero-count roots: ${knowledge.zeroCountRoots.join(', ')}`);
      if (viewport.name === 'desktop' && knowledge.emphasizedEdgesOnHover > 0 && knowledge.emphasizedEdgesAfterLeave !== 0) {
        report.failures.push(`${viewport.name} knowledge atlas keeps ${knowledge.emphasizedEdgesAfterLeave} emphasized edges after pointer leave`);
      }

      await capturePagination(page, viewport.name, 'light');
      await capturePagination(page, viewport.name, 'dark');
      await context.close();
    }

    const context = await browser.newContext({ viewport: viewports[0] });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    await settle(page);
    await page.locator('#pagination a.extend.next').click();
    await page.waitForFunction(() => location.pathname === '/page/2/' && document.querySelectorAll('#recent-posts .recent-post-item').length === 3);
    report.pjax = await inspect(page);
    if (report.pjax.logs.join(',') !== '03,02,01') {
      report.failures.push(`PJAX page 2 logs are ${report.pjax.logs.join(',')}`);
    }
    await context.close();

    const tocContext = await browser.newContext({ viewport: { width: 1878, height: 1055 } });
    const tocPage = await tocContext.newPage();
    report.tocAfterDeferredImages = await inspectTocAfterDeferredImages(tocPage);
    if (!report.tocAfterDeferredImages.active.includes('Injection Identifier')) {
      report.failures.push(`TOC drifted after deferred images: visible ${report.tocAfterDeferredImages.visibleHeading}, active ${report.tocAfterDeferredImages.active}`);
    }
    await tocContext.close();

    const navContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const navPage = await navContext.newPage();
    report.liquidNavExit = await inspectLiquidNavExit(navPage);
    if (report.liquidNavExit.inside.x !== report.liquidNavExit.fading.x) {
      report.failures.push(`Liquid lens moved during fade: ${report.liquidNavExit.inside.x} -> ${report.liquidNavExit.fading.x}`);
    }
    if (report.liquidNavExit.inside.bend !== report.liquidNavExit.fading.bend) {
      report.failures.push(`Liquid lens bend snapped during fade: ${report.liquidNavExit.inside.bend} -> ${report.liquidNavExit.fading.bend}`);
    }
    if (report.liquidNavExit.hidden.x !== '50%') {
      report.failures.push(`Liquid lens did not reset while hidden: ${report.liquidNavExit.hidden.x}`);
    }
    if (report.liquidNavExit.idle.backgroundImage !== report.liquidNavExit.inside.backgroundImage
      || report.liquidNavExit.idle.backgroundImage !== report.liquidNavExit.hidden.backgroundImage) {
      report.failures.push('Liquid nav base glow still follows the pointer and visibly recenters');
    }
    if (report.liquidNavExit.idle.backgroundImage !== 'none' || report.liquidNavExit.dark.backgroundImage !== 'none') {
      report.failures.push('Liquid nav base reverted to layered gradients');
    }
    if (report.liquidNavExit.idle.topLightOpacity > 0.2 || report.liquidNavExit.dark.topLightOpacity > 0.2) {
      report.failures.push('Liquid nav frame top light is too prominent');
    }
    report.stickyTitleExit = await inspectStickyTitleExit(navPage);
    const fixedSize = report.stickyTitleExit.fixed;
    const nearTopSize = report.stickyTitleExit.nearTop;
    if (Math.abs(fixedSize.infoWidth - nearTopSize.infoWidth) > 1
      || Math.abs(fixedSize.titleWidth - nearTopSize.titleWidth) > 1
      || fixedSize.fontSize !== nearTopSize.fontSize
      || fixedSize.lineHeight !== nearTopSize.lineHeight) {
      report.failures.push(`Sticky article title changes geometry before exit: ${fixedSize.infoWidth}/${fixedSize.fontSize} -> ${nearTopSize.infoWidth}/${nearTopSize.fontSize}`);
    }
    if (report.stickyTitleExit.arrivalObserved) {
      report.failures.push('Sticky article title replays the nav arrival animation while exiting at the page top');
    }
    if (report.stickyTitleExit.fixed.titleShadowLayers > 1) {
      report.failures.push(`Sticky article title uses ${report.stickyTitleExit.fixed.titleShadowLayers} stacked shadows: ${report.stickyTitleExit.fixed.titleShadow}`);
    }
    if (report.stickyTitleExit.settled.headerClasses.includes('nav-fixed')) {
      report.failures.push(`Sticky article title did not settle at the page top: ${report.stickyTitleExit.settled.headerClasses}`);
    }
    report.articleCategoryIcons = await inspectArticleCategoryIcons(navPage);
    const missingCategoryIcons = report.articleCategoryIcons.filter(item => !item.iconClass || !item.iconCategory);
    if (missingCategoryIcons.length) {
      report.failures.push(`Article categories miss individual icons: ${missingCategoryIcons.map(item => item.category).join(', ')}`);
    }
    report.articleSurfaceOpacity = await inspectArticleSurfaceOpacity(navPage);
    if (report.articleSurfaceOpacity.light.alpha < 0.72 || report.articleSurfaceOpacity.dark.alpha < 0.7) {
      report.failures.push(`Article surface opacity is below the reading target: ${report.articleSurfaceOpacity.light.color} / ${report.articleSurfaceOpacity.dark.color}`);
    }
    if (report.articleSurfaceOpacity.dark.selectionBackground === 'rgb(0, 196, 182)') {
      report.failures.push(`Dark article selection still uses the glaring theme cyan: ${report.articleSurfaceOpacity.dark.selectionBackground}`);
    }
    report.darkArticleImage = await inspectDarkArticleImage(navPage);
    if (report.darkArticleImage.resting.brightness > 0.84) {
      report.failures.push(`Dark article white figure is too bright: ${report.darkArticleImage.resting.filter}`);
    }
    if (Math.abs(report.darkArticleImage.hovering.brightness - report.darkArticleImage.resting.brightness) > 0.005) {
      report.failures.push(`Dark article figure changes brightness on hover: ${report.darkArticleImage.resting.filter} -> ${report.darkArticleImage.hovering.filter}`);
    }
    report.allArticleTocAlignment = await inspectAllArticleTocAlignment(navPage);
    report.allArticleTocAlignment.forEach(result => {
      if (result.status !== 200) report.failures.push(`${result.path} returned ${result.status} during TOC audit`);
      if (result.headingCount !== result.tocCount || result.structureMismatches.length) {
        report.failures.push(`${result.path} TOC structure is misaligned: ${result.headingCount} headings / ${result.tocCount} links; ${result.structureMismatches.join(', ')}`);
      }
      if (result.activeMismatches.length) {
        report.failures.push(`${result.path} TOC active state drifted at ${result.activeMismatches.map(item => item.heading).join(', ')}`);
      }
    });
    report.redundantBlogBuilding = {
      tagPageExists: fsSync.existsSync(path.join(process.cwd(), 'public', 'tags', '博客搭建', 'index.html')),
      taxonomyContainsConcept: fsSync.readFileSync(path.join(process.cwd(), 'public', 'data', 'knowledge-taxonomy-v2.json'), 'utf8').includes('博客搭建'),
      indexContainsConcept: fsSync.readFileSync(path.join(process.cwd(), 'public', 'data', 'knowledge-index-v1.json'), 'utf8').includes('博客搭建')
    };
    if (Object.values(report.redundantBlogBuilding).some(Boolean)) {
      report.failures.push(`Redundant 博客搭建 taxonomy remains: ${JSON.stringify(report.redundantBlogBuilding)}`);
    }
    await navContext.close();
  } finally {
    await browser.close();
    await fs.writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  }

  if (report.failures.length) {
    throw new Error(`QA failed:\n${report.failures.join('\n')}`);
  }
  console.log(`QA passed: ${report.cases.length} page/viewport cases; report at ${path.join(outputDir, 'report.json')}`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
