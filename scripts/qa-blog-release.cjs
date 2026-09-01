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
        color: style.color,
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

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  const launchOptions = { headless: true };
  if (chromePath && fsSync.existsSync(chromePath)) launchOptions.executablePath = chromePath;
  const browser = await chromium.launch(launchOptions);
  const report = { baseUrl, generatedAt: new Date().toISOString(), cases: [], pjax: null, failures: [] };

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
