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
        borderRadius: style.borderRadius,
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

  if (!compact) {
    const canvas = page.locator('.atlas-v2__canvas');
    await canvas.screenshot({ path: path.join(outputDir, 'atlas-ai-four-axis-light.png') });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await page.waitForTimeout(180);
    await canvas.screenshot({ path: path.join(outputDir, 'atlas-ai-four-axis-dark.png') });
  }
  return result;
}

async function inspectLiquidNavExit(page) {
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  const menus = page.locator('#nav #menus');
  const box = await menus.boundingBox();
  await page.mouse.move(box.x + 48, box.y + box.height / 2);
  await page.waitForTimeout(120);
  const read = () => menus.evaluate(element => ({
    x: element.style.getPropertyValue('--ops-liquid-x'),
    active: element.classList.contains('is-liquid-active'),
    opacity: Number(getComputedStyle(element, '::after').opacity)
  }));
  const inside = await read();
  await page.mouse.move(box.x - 30, box.y + box.height + 80);
  await page.waitForTimeout(80);
  const fading = await read();
  await page.waitForTimeout(220);
  const hidden = await read();
  return { inside, fading, hidden };
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
      }

      const knowledge = await inspectKnowledgeAtlas(page, viewport.name);
      report.knowledge.push(knowledge);
      const expectedAxes = ['ai-security', 'ai-threats', 'ai-defenses', 'ai-systems', 'ai-mechanisms'];
      const missingAxes = expectedAxes.filter(tag => !knowledge.tags.includes(tag));
      if (knowledge.httpStatus !== 200 || knowledge.status !== 'ready') report.failures.push(`${viewport.name} knowledge atlas failed to load`);
      if (knowledge.horizontalOverflow) report.failures.push(`${viewport.name} knowledge atlas has horizontal overflow`);
      if (knowledge.overlaps.length) report.failures.push(`${viewport.name} knowledge atlas overlaps ${knowledge.overlaps.join(', ')}`);
      if (missingAxes.length) report.failures.push(`${viewport.name} knowledge atlas misses ${missingAxes.join(', ')}`);
      if (knowledge.missingTitles.length) report.failures.push(`${viewport.name} knowledge nodes miss full labels: ${knowledge.missingTitles.join(', ')}`);

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
    if (report.liquidNavExit.hidden.x !== '50%') {
      report.failures.push(`Liquid lens did not reset while hidden: ${report.liquidNavExit.hidden.x}`);
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

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
