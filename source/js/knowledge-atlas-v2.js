(() => {
  'use strict';

  const PAGE_SELECTOR = '.type-knowledge, .page-type-knowledge, [data-page-type="knowledge"]';
  const LOADER_SELECTOR = '.ops-module-loading';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ROOT_PREVIEW_LIMIT = 3;
  const RELATED_BRANCH_LIMIT = 3;
  const state = {
    category: '',
    tag: '',
    facet: '',
    query: '',
    zoom: 1,
    panX: 0,
    panY: 0
  };

  let taxonomy;
  let relationConfig = { aliases: {}, links: [] };
  let hoverTag = '';
  let posts = [];
  let concepts = new Map();
  let aliasMap = new Map();
  let rootSlugs = [];
  let mounted = false;
  let reduceMotion = false;
  let graphFrame = 0;
  let graphVisible = true;
  let lifecycleController;
  let focusOrigin = null;
  let resultsRevision = 0;

  const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const normalize = value => String(value ?? '').trim().toLowerCase();
  const compactText = value => String(value ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  function findHost() {
    const page = document.querySelector(PAGE_SELECTOR);
    if (!page) return null;
    const loader = page.querySelector(LOADER_SELECTOR);
    return loader ? { loader, page } : null;
  }

  function icon(name) {
    const paths = {
      compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.6 5.4L8 16l2.6-5.4L16 8Z"/>',
      book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
      medal: '<path d="M8 3h8l-1 7H9L8 3Z"/><circle cx="12" cy="15" r="5"/><path d="m10.5 15 1 1 2-2"/>',
      code: '<path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14"/>',
      cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3m6-3v3M9 20v3m6-3v3M20 9h3m-3 6h3M1 9h3m-3 6h3"/>',
      lines: '<path d="M4 6h16M4 12h12M4 18h16"/>',
      flag: '<path d="M5 21V4m0 1c5-3 9 3 14 0v9c-5 3-9-3-14 0"/>',
      search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
      minus: '<path d="M5 12h14"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
      chevron: '<path d="m9 18 6-6-6-6"/>'
    };
    const body = paths[name] || paths.compass;
    return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  }

  function categoryIcon(item) {
    const map = {
      'book-open': 'fa-book', medal: 'fa-medal', code: 'fa-code', cpu: 'fa-microchip',
      'align-left': 'fa-align-left', flag: 'fa-flag'
    };
    return `<i class="fas ${map[item.icon] || 'fa-compass'}" aria-hidden="true"></i>`;
  }

  function flattenTaxonomy() {
    concepts = new Map();
    aliasMap = new Map();
    rootSlugs = [];

    const visit = (node, parent = '', root = '') => {
      if (!node?.slug || !node?.name) throw new Error('知识分类存在缺少名称或 slug 的节点');
      if (concepts.has(node.slug)) throw new Error(`知识分类存在重复 slug：${node.slug}`);
      const currentRoot = root || node.slug;
      const item = {
        ...node,
        parent,
        root: currentRoot,
        children: (node.children || []).map(child => child.slug)
      };
      concepts.set(node.slug, item);
      [node.name, node.slug, ...(node.aliases || [])].forEach(alias => {
        const key = normalize(alias);
        const existing = aliasMap.get(key);
        if (existing && existing !== node.slug) throw new Error(`知识标签别名冲突：${alias}`);
        aliasMap.set(key, node.slug);
      });
      (node.children || []).forEach(child => visit(child, node.slug, currentRoot));
    };

    taxonomy.roots.forEach(root => {
      rootSlugs.push(root.slug);
      visit(root);
    });

    Object.entries(relationConfig.aliases || {}).forEach(([alias, canonical]) => {
      const target = aliasMap.get(normalize(canonical));
      if (!target) throw new Error(`关系别名指向未知标签：${alias} -> ${canonical}`);
      const key = normalize(alias);
      const existing = aliasMap.get(key);
      if (existing && existing !== target) throw new Error(`关系别名冲突：${alias}`);
      aliasMap.set(key, target);
    });

    (relationConfig.links || []).forEach(link => {
      if (!aliasMap.get(normalize(link.source)) || !aliasMap.get(normalize(link.target))) {
        throw new Error(`关系包含未知标签：${link.source} -> ${link.target}`);
      }
    });
  }

  function parseKnowledgeIndex(payload) {
    if (!payload || payload.version !== 1 || !Array.isArray(payload.posts)) {
      throw new Error('知识文章索引格式无效');
    }
    return payload.posts.map((entry, index) => {
      const title = compactText(entry.title);
      const url = compactText(entry.url);
      const content = compactText(entry.content);
      const categories = [...new Set((entry.categories || []).map(compactText).filter(Boolean))];
      const tags = [...new Set((entry.tags || []).map(compactText).filter(Boolean))];
      const knowledge = [...new Set((entry.knowledge || []).map(compactText).filter(Boolean))];
      const unknown = knowledge.filter(term => !aliasMap.has(normalize(term)));
      if (unknown.length) throw new Error(`${title || url} 含未知知识概念：${unknown.join('、')}`);
      const conceptSlugs = [...new Set(knowledge.map(term => aliasMap.get(normalize(term))))];
      return { id: `post-${index + 1}`, title, url, content, categories, tags, knowledge, conceptSlugs };
    }).filter(post => post.title && post.url);
  }

  function categoryBySlug(slug) {
    return taxonomy.categories.find(item => item.slug === slug);
  }

  function parseUrlState() {
    const params = new URLSearchParams(location.search);
    const c = params.get('c') || '';
    const t = params.get('t') || '';
    const f = params.get('f') || '';
    state.category = categoryBySlug(c) ? c : '';
    state.tag = concepts.has(t) ? t : '';
    state.facet = taxonomy.facets.some(group => group.values.some(value => value.slug === f)) ? f : '';
  }

  function writeUrl(mode = 'replace') {
    const url = new URL(location.href);
    ['c', 't', 'd', 'f'].forEach(key => url.searchParams.delete(key));
    if (state.category) url.searchParams.set('c', state.category);
    if (state.tag) url.searchParams.set('t', state.tag);
    if (state.facet) url.searchParams.set('f', state.facet);
    history[mode === 'push' ? 'pushState' : 'replaceState']({}, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function postMatchesFilters(post) {
    if (state.category) {
      const category = categoryBySlug(state.category);
      if (!post.categories.some(value => normalize(value) === normalize(category.name))) return false;
    }
    if (state.facet) {
      const facetValue = taxonomy.facets.flatMap(group => group.values).find(value => value.slug === state.facet);
      if (!facetValue || !post.tags.some(value => normalize(value) === normalize(facetValue.name))) return false;
    }
    if (state.query) {
      const haystack = normalize([post.title, post.content, ...post.categories, ...post.tags, ...post.knowledge].join(' '));
      if (!haystack.includes(normalize(state.query))) return false;
    }
    return true;
  }

  function filteredPosts() {
    return posts.filter(postMatchesFilters);
  }

  function subtreeSlugs(slug) {
    return new Set([slug, ...descendants(slug, Number.POSITIVE_INFINITY).map(item => item.slug)]);
  }

  function postsForConcept(slug, sourcePosts = filteredPosts()) {
    const slugs = subtreeSlugs(slug);
    return sourcePosts.filter(post => post.conceptSlugs.some(postSlug => slugs.has(postSlug)));
  }

  function conceptUsage(slug, sourcePosts = filteredPosts()) {
    return postsForConcept(slug, sourcePosts).length;
  }

  function ancestors(slug) {
    const list = [];
    let cursor = concepts.get(slug);
    while (cursor?.parent) {
      list.unshift(cursor.parent);
      cursor = concepts.get(cursor.parent);
    }
    return list;
  }

  function cooccurrence(slug, sourcePosts) {
    const scores = new Map();
    const sourceRoot = concepts.get(slug)?.root;
    sourcePosts.filter(post => post.conceptSlugs.includes(slug)).forEach(post => {
      post.conceptSlugs.forEach(other => {
        // A shared article is useful evidence only inside the same knowledge domain.
        // Cross-domain relations must be deliberate entries in knowledge-relations.json.
        const slugAncestors = ancestors(slug);
        const otherAncestors = ancestors(other);
        const skipsKnownLevel = slugAncestors.includes(other) || otherAncestors.includes(slug);
        const isDirectTreeNeighbor = concepts.get(slug)?.parent === other || concepts.get(other)?.parent === slug;
        if (other !== slug && concepts.get(other)?.root === sourceRoot && (!skipsKnownLevel || isDirectTreeNeighbor)) {
          scores.set(other, (scores.get(other) || 0) + 1);
        }
      });
    });
    return [...scores.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }

  function explicitRelations(slug) {
    return (relationConfig.links || []).flatMap(link => {
      const source = aliasMap.get(normalize(link.source));
      const target = aliasMap.get(normalize(link.target));
      if (!source || !target || (source !== slug && target !== slug)) return [];
      return [{
        source,
        target,
        type: link.kind || 'curated',
        weight: Number(link.weight) || 1
      }];
    });
  }

  function descendants(slug, maxDepth) {
    const list = [];
    let frontier = (concepts.get(slug)?.children || []).map(child => ({ slug: child, parent: slug, level: 1 }));
    while (frontier.length) {
      const current = frontier.shift();
      if (current.level > maxDepth) continue;
      list.push(current);
      if (current.level < maxDepth) {
        (concepts.get(current.slug)?.children || []).forEach(child => {
          frontier.push({ slug: child, parent: current.slug, level: current.level + 1 });
        });
      }
    }
    return list;
  }

  function relatedCandidates(slug, sourcePosts, excluded) {
    const candidates = new Map();
    explicitRelations(slug).forEach(edge => {
      const other = edge.source === slug ? edge.target : edge.source;
      if (excluded.has(other)) return;
      candidates.set(other, {
        slug: other,
        kind: edge.type,
        weight: edge.weight,
        priority: 2
      });
    });
    cooccurrence(slug, sourcePosts).forEach(([other, score]) => {
      if (excluded.has(other) || candidates.has(other)) return;
      candidates.set(other, {
        slug: other,
        kind: 'cooccurrence',
        weight: score,
        priority: 1
      });
    });
    return [...candidates.values()]
      .sort((a, b) => b.priority - a.priority || b.weight - a.weight || a.slug.localeCompare(b.slug))
      .slice(0, RELATED_BRANCH_LIMIT);
  }

  function neighborhood() {
    const sourcePosts = filteredPosts();
    if (!state.tag) {
      const nodes = [];
      rootSlugs.forEach(rootSlug => {
        const root = concepts.get(rootSlug);
        const used = conceptUsage(rootSlug, sourcePosts);
        if (used || !state.category) nodes.push({ slug: rootSlug, role: 'root', level: 1, hop: 1, weight: Math.max(1, used) });
        root.children
          .map(child => ({ slug: child, count: conceptUsage(child, sourcePosts) }))
          .filter(item => item.count)
          .sort((a, b) => b.count - a.count)
          .slice(0, ROOT_PREVIEW_LIMIT)
          .forEach(item => nodes.push({ slug: item.slug, role: 'concept', level: 2, hop: 2, weight: item.count }));
      });
      const visible = new Set(nodes.map(node => node.slug));
      const edges = nodes
        .filter(node => concepts.get(node.slug)?.parent && visible.has(concepts.get(node.slug).parent))
        .map(node => ({ source: concepts.get(node.slug).parent, target: node.slug, type: 'tree', hop: 2, weight: 1 }));
      return { nodes, edges, articles: sourcePosts, directPosts: sourcePosts };
    }

    const directPosts = postsForConcept(state.tag, sourcePosts);
    const ancestorSlugs = ancestors(state.tag);
    const descendantItems = descendants(state.tag, 1);
    const hierarchySlugs = new Set([state.tag, ...ancestorSlugs, ...descendantItems.map(item => item.slug)]);
    const relatedItems = relatedCandidates(state.tag, sourcePosts, hierarchySlugs);
    const nodes = [
      ...ancestorSlugs.map((slug, index) => ({
        slug,
        role: 'ancestor',
        level: index - ancestorSlugs.length,
        hop: ancestorSlugs.length - index,
        weight: conceptUsage(slug, sourcePosts)
      })),
      { slug: state.tag, role: 'focus', level: 0, hop: 0, weight: conceptUsage(state.tag, sourcePosts) },
      ...descendantItems.map(item => ({
        ...item,
        role: 'descendant',
        hop: item.level,
        weight: conceptUsage(item.slug, sourcePosts)
      })),
      ...relatedItems.map((item, index) => ({
        ...item,
        role: 'related',
        level: 0,
        hop: 1,
        side: relatedItems.length === 1 || index % 2 ? 'right' : 'left',
        weight: conceptUsage(item.slug, sourcePosts)
      }))
    ];
    const edges = [];
    const hierarchyPath = [...ancestorSlugs, state.tag];
    hierarchyPath.slice(1).forEach((slug, index) => {
      edges.push({ source: hierarchyPath[index], target: slug, type: 'tree', hop: 1, weight: 1 });
    });
    descendantItems.forEach(item => {
      edges.push({ source: item.parent, target: item.slug, type: 'tree', hop: item.level, weight: 1 });
    });
    relatedItems.forEach(item => {
      edges.push({ source: state.tag, target: item.slug, type: 'related', kind: item.kind, hop: 1, weight: item.weight });
    });
    const neighborSlugs = new Set(nodes.map(node => node.slug));
    const neighborPosts = sourcePosts.filter(post => post.conceptSlugs.some(slug => neighborSlugs.has(slug)));
    const hoverPosts = hoverTag
      ? postsForConcept(hoverTag, sourcePosts)
      : [];
    const articles = [
      ...hoverPosts,
      ...directPosts.filter(post => !hoverPosts.includes(post)),
      ...neighborPosts.filter(post => !hoverPosts.includes(post) && !directPosts.includes(post))
    ];
    return { nodes, edges: uniqueEdges(edges), articles, directPosts };
  }

  function uniqueEdges(edges) {
    const seen = new Set();
    return edges.filter(edge => {
      const key = edge.type === 'tree'
        ? `${edge.type}:${edge.source}>${edge.target}`
        : `${edge.type}:${[edge.source, edge.target].sort().join(':')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function buildShell(host) {
    const wrapper = document.createElement('section');
    wrapper.className = 'atlas-v2';
    wrapper.setAttribute('aria-labelledby', 'atlas-v2-title');
    wrapper.innerHTML = `
      <header class="atlas-v2__header">
        <div class="atlas-v2__heading">
          <span class="atlas-v2__eyebrow">KNOWLEDGE ATLAS / V2</span>
          <h1 id="atlas-v2-title">以分类定坐标，以标签织脉络</h1>
        </div>
        <label class="atlas-v2__search">
          ${icon('search')}
          <input type="search" name="knowledge-query" autocomplete="off" placeholder="检索标题、正文或标签…" aria-label="检索知识索引">
          <button type="button" data-action="clear-search" hidden>清除</button>
        </label>
      </header>
      <div class="atlas-v2__facets" aria-label="筛选维度"></div>
      <div class="atlas-v2__body">
        <aside class="atlas-v2__rail" aria-label="文章分类"></aside>
        <main class="atlas-v2__stage">
          <div class="atlas-v2__trail"></div>
          <div class="atlas-v2__canvas" tabindex="0" role="region" aria-label="可缩放知识网络；方向键平移，加减键缩放，Home 重置">
            <svg viewBox="0 0 900 620" role="group" aria-label="知识标签关系图"></svg>
            <div class="atlas-v2__controls" aria-label="星图控制">
              <button type="button" data-action="zoom-out" title="缩小" aria-label="缩小知识网络">${icon('minus')}</button>
              <button type="button" data-action="zoom-in" title="放大" aria-label="放大知识网络">${icon('plus')}</button>
              <button type="button" data-action="reset-view" title="重置视图" aria-label="重置知识网络视图">${icon('reset')}</button>
            </div>
          </div>
        </main>
        <aside class="atlas-v2__results" aria-live="polite"></aside>
      </div>
      <noscript><p class="atlas-v2__fallback">启用 JavaScript 后可浏览交互式知识网络；文章仍可从归档页访问。</p></noscript>
    `;
    host.loader.replaceWith(wrapper);
    return wrapper;
  }

  function renderRail(root) {
    const sourcePosts = posts.filter(post => {
      const oldCategory = state.category;
      const oldQuery = state.query;
      state.category = '';
      state.query = '';
      const match = postMatchesFilters(post);
      state.category = oldCategory;
      state.query = oldQuery;
      return match;
    });
    const allButton = `
      <button type="button" class="atlas-v2__category ${state.category ? '' : 'is-active'}" data-category="">
        <span class="atlas-v2__category-icon ops-atlas-category-icon"><i class="fas fa-compass" aria-hidden="true"></i></span>
        <span><strong>全部记录</strong><small>ALL TOPICS</small></span><b>${sourcePosts.length}</b>
      </button>`;
    root.querySelector('.atlas-v2__rail').innerHTML = allButton + taxonomy.categories.map(category => {
      const count = sourcePosts.filter(post => post.categories.some(value => normalize(value) === normalize(category.name))).length;
      return `
        <button type="button" class="atlas-v2__category ${state.category === category.slug ? 'is-active' : ''}" data-category="${category.slug}">
          <span class="atlas-v2__category-icon ops-atlas-category-icon ${category.slug === 'milestones' ? 'is-milestone' : ''}" data-ops-category="${category.slug === 'milestones' ? 'milestone' : category.slug}">${categoryIcon(category)}</span>
          <span><strong>${escapeHtml(category.label)}</strong><small>${escapeHtml(category.en)}</small></span><b>${count}</b>
        </button>`;
    }).join('');
  }

  function renderFacets(root) {
    const items = taxonomy.facets.flatMap(group => group.values.map(value => ({ ...value, group: group.name })));
    const container = root.querySelector('.atlas-v2__facets');
    if (!items.length) {
      container.hidden = true;
      container.replaceChildren();
      return;
    }
    container.hidden = false;
    container.innerHTML = `
      <span>FILTER</span>
      ${items.map(item => `<button type="button" class="${state.facet === item.slug ? 'is-active' : ''}" data-facet="${item.slug}" title="${escapeHtml(item.group)}">${escapeHtml(item.name)}</button>`).join('')}
      ${(state.category || state.tag || state.facet || state.query) ? '<button type="button" data-action="reset-all">重置</button>' : ''}
    `;
  }

  function renderTrail(root) {
    const parts = [];
    if (state.category) parts.push({ type: 'category', label: categoryBySlug(state.category).label });
    if (state.tag) {
      ancestors(state.tag).forEach(slug => parts.push({ type: 'tag', slug, label: concepts.get(slug).name }));
      parts.push({ type: 'tag', slug: state.tag, label: concepts.get(state.tag).name });
    }
    const trail = root.querySelector('.atlas-v2__trail');
    trail.innerHTML = parts.length
      ? `<button type="button" data-action="overview">知识星图</button>${parts.map(part => `<span>/</span><button type="button" data-tag="${part.slug || ''}" ${part.type === 'category' ? 'disabled' : ''}>${escapeHtml(part.label)}</button>`).join('')}`
      : '<span>拖动平移 · 滚轮缩放 · 单击节点聚焦</span>';
  }

  function labelWidth(slug) {
    const data = concepts.get(slug);
    const count = conceptUsage(slug);
    return Math.max(86, Math.min(170, 38 + (data?.name.length || 0) * 18 + String(count).length * 9));
  }

  function nodeLabel(name, limit = 11) {
    const glyphs = Array.from(String(name || ''));
    return glyphs.length > limit ? `${glyphs.slice(0, limit).join('')}…` : glyphs.join('');
  }

  function relaxCollisions(graph, positions, fixedSlugs = new Set()) {
    const anchors = new Map([...positions].map(([slug, point]) => [slug, { ...point }]));
    const nodes = graph.nodes.filter(node => positions.has(node.slug));
    for (let pass = 0; pass < 44; pass += 1) {
      for (let i = 0; i < nodes.length; i += 1) {
        for (let j = i + 1; j < nodes.length; j += 1) {
          const a = nodes[i];
          const b = nodes[j];
          const pa = positions.get(a.slug);
          const pb = positions.get(b.slug);
          const dx = pb.x - pa.x || 0.01;
          const dy = pb.y - pa.y || 0.01;
          const overlapX = (labelWidth(a.slug) + labelWidth(b.slug)) / 2 + 18 - Math.abs(dx);
          const overlapY = 58 - Math.abs(dy);
          if (overlapX <= 0 || overlapY <= 0) continue;
          const moveA = fixedSlugs.has(a.slug) ? 0 : 0.5;
          const moveB = fixedSlugs.has(b.slug) ? 0 : 0.5;
          if (overlapX / 180 < overlapY / 58) {
            const push = Math.sign(dx) * Math.min(12, overlapX * 0.55);
            pa.x -= push * moveA;
            pb.x += push * moveB;
          } else {
            const push = Math.sign(dy) * Math.min(10, overlapY * 0.55);
            pa.y -= push * moveA;
            pb.y += push * moveB;
          }
        }
      }
      nodes.forEach(node => {
        if (fixedSlugs.has(node.slug)) return;
        const point = positions.get(node.slug);
        const anchor = anchors.get(node.slug);
        point.x += (anchor.x - point.x) * 0.035;
        point.y += (anchor.y - point.y) * 0.035;
        const halfWidth = labelWidth(node.slug) / 2;
        point.x = Math.max(halfWidth + 20, Math.min(880 - halfWidth, point.x));
        point.y = Math.max(38, Math.min(582, point.y));
      });
    }
    return positions;
  }

  function placeRow(positions, items, y, minX = 104, maxX = 796) {
    if (!items.length) return;
    if (items.length === 1) {
      positions.set(items[0].slug, { x: 450, y });
      return;
    }
    items.forEach((item, index) => {
      positions.set(item.slug, {
        x: minX + index * ((maxX - minX) / (items.length - 1)),
        y
      });
    });
  }

  function layoutGraph(graph) {
    const width = 900;
    const height = 620;
    const center = { x: width / 2, y: height / 2 };
    const positions = new Map();

    if (!state.tag) {
      const roots = graph.nodes.filter(node => node.role === 'root');
      roots.forEach((node, index) => {
        const angle = (-Math.PI / 2) + index * (Math.PI * 2 / Math.max(roots.length, 1));
        positions.set(node.slug, { x: center.x + Math.cos(angle) * 190, y: center.y + Math.sin(angle) * 150, angle });
      });
      graph.nodes.filter(node => node.role !== 'root').forEach(node => {
        const parent = concepts.get(node.slug).parent;
        const base = positions.get(parent) || center;
        const siblings = concepts.get(parent)?.children.filter(child => graph.nodes.some(item => item.slug === child)) || [];
        const siblingIndex = siblings.indexOf(node.slug);
        const angle = (base.angle ?? Math.atan2(base.y - center.y, base.x - center.x)) + (siblingIndex - (siblings.length - 1) / 2) * 0.38;
        positions.set(node.slug, { x: center.x + Math.cos(angle) * 354, y: center.y + Math.sin(angle) * 248, angle });
      });
      positions.set('__center', center);
      return relaxCollisions(graph, positions);
    }

    const focus = { x: 450, y: 292 };
    const ancestorItems = graph.nodes.filter(node => node.role === 'ancestor').sort((a, b) => a.level - b.level);
    const directChildren = graph.nodes.filter(node => node.role === 'descendant' && node.level === 1);
    const secondLevel = graph.nodes.filter(node => node.role === 'descendant' && node.level === 2);
    const related = graph.nodes.filter(node => node.role === 'related');

    positions.set(state.tag, focus);
    if (ancestorItems.length === 1) {
      positions.set(ancestorItems[0].slug, { x: 450, y: 142 });
    } else {
      ancestorItems.forEach((item, index) => {
        positions.set(item.slug, { x: 450, y: 86 + index * (92 / Math.max(ancestorItems.length - 1, 1)) });
      });
    }

    if (directChildren.length > 5) {
      const split = Math.ceil(directChildren.length / 2);
      placeRow(positions, directChildren.slice(0, split), 408, 118, 782);
      placeRow(positions, directChildren.slice(split), 510, 156, 744);
    } else {
      placeRow(positions, directChildren, 432, 116, 784);
    }
    const secondByParent = new Map();
    secondLevel.forEach(item => {
      if (!secondByParent.has(item.parent)) secondByParent.set(item.parent, []);
      secondByParent.get(item.parent).push(item);
    });
    secondByParent.forEach((items, parentSlug) => {
      const parentPoint = positions.get(parentSlug) || focus;
      const widths = items.map(item => labelWidth(item.slug));
      const gap = 18;
      const totalWidth = widths.reduce((sum, width) => sum + width, 0) + gap * Math.max(0, items.length - 1);
      let cursor = Math.max(28, Math.min(872 - totalWidth, parentPoint.x - totalWidth / 2));
      items.forEach((item, index) => {
        const width = widths[index];
        positions.set(item.slug, {
          x: cursor + width / 2,
          y: 554
        });
        cursor += width + gap;
      });
    });

    related.forEach(item => {
      positions.set(item.slug, { x: item.side === 'left' ? 122 : 778, y: 292 });
    });
    return positions;
  }

  function svgElement(tag, attrs = {}) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  }

  function mobileNodeMarkup(item, meta) {
    const data = concepts.get(item.slug);
    const more = data.children.length ? ` · 更多 ${data.children.length}` : '';
    return `<button type="button" class="atlas-v2__mobile-node atlas-v2__mobile-node--${item.role} atlas-v2__mobile-node--hop-${item.hop ?? 1} ${item.slug === state.tag ? 'is-active' : ''}" data-tag="${item.slug}" title="${escapeHtml(data.name)}"><span><strong>${escapeHtml(data.name)}</strong><small>${escapeHtml(meta + more)}</small></span><b>${conceptUsage(item.slug)}</b></button>`;
  }

  function mobileSection(label, items, describe) {
    if (!items.length) return '';
    return `<section class="atlas-v2__mobile-branch"><header>${escapeHtml(label)}</header>${items.map(item => mobileNodeMarkup(item, describe(item))).join('')}</section>`;
  }

  function mobileGraphMarkup(graph) {
    if (!state.tag) {
      return `<div class="atlas-v2__mobile-list" role="group" aria-label="知识主题总览">${graph.nodes.map(item => mobileNodeMarkup(item, item.role === 'root' ? '主题层' : '标签层')).join('') || '<p class="atlas-v2__empty">当前筛选下没有知识标签。</p>'}</div>`;
    }
    const ancestorsInView = graph.nodes.filter(item => item.role === 'ancestor').sort((a, b) => a.level - b.level);
    const focus = graph.nodes.filter(item => item.role === 'focus');
    const descendantsInView = graph.nodes.filter(item => item.role === 'descendant').sort((a, b) => a.level - b.level);
    const related = graph.nodes.filter(item => item.role === 'related');
    return `<div class="atlas-v2__mobile-tree" role="group" aria-label="当前知识层级">
      ${mobileSection('上级路径', ancestorsInView, item => item === ancestorsInView.at(-1) ? '直接上级' : '上级路径')}
      ${mobileSection('当前节点', focus, () => '当前焦点')}
      ${mobileSection('下级节点', descendantsInView, item => item.level === 1 ? '直接下级' : `${concepts.get(item.parent)?.name || '下级'} / 延伸节点`)}
      ${mobileSection('关联 · 最多 2 项', related, item => item.kind === 'cooccurrence' ? '文章共现' : '人工关联')}
    </div>`;
  }

  function pointOnNodeEdge(from, to, slug, padding = 5) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const halfWidth = labelWidth(slug) / 2 + padding;
    const halfHeight = 24 + padding;
    const scale = 1 / Math.max(Math.abs(dx) / halfWidth, Math.abs(dy) / halfHeight, 0.001);
    return { x: from.x + dx * scale, y: from.y + dy * scale };
  }

  function edgePath(edge, a, b) {
    if (!state.tag) {
      const start = pointOnNodeEdge(a, b, edge.source);
      const end = pointOnNodeEdge(b, a, edge.target);
      return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    }
    if (edge.type === 'tree') {
      const startY = a.y + 24;
      const endY = b.y - 24;
      if (Number.isFinite(edge.busY)) {
        return `M ${b.x} ${edge.busY} L ${b.x} ${endY}`;
      }
      if (a.y < 340 && b.y > 460) {
        const laneY = 364;
        const approachY = b.y - 36;
        const laneX = [230, 450, 670].reduce((best, value) => Math.abs(value - b.x) < Math.abs(best - b.x) ? value : best, 230);
        return `M ${a.x} ${startY} L ${a.x} ${laneY} L ${laneX} ${laneY} L ${laneX} ${approachY} L ${b.x} ${approachY} L ${b.x} ${endY}`;
      }
      const middleY = startY + (endY - startY) * 0.5;
      const corner = Math.min(12, Math.abs(endY - startY) * 0.18, Math.abs(b.x - a.x) * 0.18);
      const direction = b.x >= a.x ? 1 : -1;
      return `M ${a.x} ${startY} L ${a.x} ${middleY - corner} Q ${a.x} ${middleY} ${a.x + direction * corner} ${middleY} L ${b.x - direction * corner} ${middleY} Q ${b.x} ${middleY} ${b.x} ${middleY + corner} L ${b.x} ${endY}`;
    }
    const direction = b.x >= a.x ? 1 : -1;
    const startX = a.x + direction * (labelWidth(edge.source) / 2 + 5);
    const endX = b.x - direction * (labelWidth(edge.target) / 2 + 5);
    const middleX = startX + (endX - startX) * 0.5;
    return `M ${startX} ${a.y} C ${middleX} ${a.y}, ${middleX} ${b.y}, ${endX} ${b.y}`;
  }

  function directChildrenInView(graph) {
    if (!state.tag) return [];
    return graph.nodes.filter(item => item.role === 'descendant' && item.level === 1);
  }

  function appendDirectChildBus(group, graph, positions) {
    const directChildren = directChildrenInView(graph);
    if (directChildren.length < 4) return new Map();
    const focus = positions.get(state.tag);
    if (!focus) return new Map();
    const rows = new Map();
    directChildren.forEach(item => {
      const point = positions.get(item.slug);
      if (!point) return;
      if (!rows.has(point.y)) rows.set(point.y, []);
      rows.get(point.y).push({ item, point });
    });
    const busByTarget = new Map();
    const rowEntries = [...rows.entries()].sort((a, b) => a[0] - b[0]);
    const lastBusY = Math.max(...rowEntries.map(([y]) => y - 50));
    group.appendChild(svgElement('path', {
      d: `M ${focus.x} ${focus.y + 24} L ${focus.x} ${lastBusY}`,
      class: 'atlas-v2__edge-bus'
    }));
    rowEntries.forEach(([y, entries]) => {
      const busY = y - 50;
      const minX = Math.min(...entries.map(({ point }) => point.x));
      const maxX = Math.max(...entries.map(({ point }) => point.x));
      group.appendChild(svgElement('path', {
        d: `M ${minX} ${busY} L ${maxX} ${busY}`,
        class: 'atlas-v2__edge-bus'
      }));
      entries.forEach(({ item }) => busByTarget.set(item.slug, busY));
    });
    return busByTarget;
  }

  function appendHierarchyGuides(viewport, graph, positions) {
    const guides = svgElement('g', { class: 'atlas-v2__hierarchy-guides', 'aria-hidden': 'true' });
    const focus = positions.get(state.tag);
    const ancestorItems = graph.nodes.filter(item => item.role === 'ancestor');
    const firstLevel = graph.nodes.filter(item => item.role === 'descendant' && item.level === 1);
    const secondLevel = graph.nodes.filter(item => item.role === 'descendant' && item.level === 2);
    const related = graph.nodes.filter(item => item.role === 'related');
    const lowest = secondLevel.length
      ? Math.max(...secondLevel.map(item => positions.get(item.slug).y))
      : firstLevel.length
        ? Math.max(...firstLevel.map(item => positions.get(item.slug).y))
        : focus.y;
    const highest = ancestorItems.length
      ? Math.min(...ancestorItems.map(item => positions.get(item.slug).y))
      : focus.y;
    guides.appendChild(svgElement('line', {
      x1: 450, y1: Math.max(46, highest - 42), x2: 450, y2: Math.min(590, lowest + 42),
      class: 'atlas-v2__hierarchy-spine'
    }));
    const bands = [
      ancestorItems.length && { label: 'UPSTREAM / 上级', y: highest - 38 },
      { label: 'FOCUS / 当前', y: focus.y - 48 }
    ].filter(Boolean);
    bands.forEach(band => {
      guides.appendChild(svgElement('line', { x1: 28, y1: band.y + 8, x2: 872, y2: band.y + 8, class: 'atlas-v2__hierarchy-rule' }));
      const label = svgElement('text', { x: 30, y: band.y, class: 'atlas-v2__hierarchy-label' });
      label.textContent = band.label;
      guides.appendChild(label);
    });
    if (related.length) {
      const label = svgElement('text', {
        x: related.some(item => item.side === 'right') ? 868 : 32,
        y: focus.y - 48,
        class: 'atlas-v2__hierarchy-label atlas-v2__hierarchy-label--related',
        'text-anchor': related.some(item => item.side === 'right') ? 'end' : 'start'
      });
      label.textContent = 'RELATED / 关联';
      guides.appendChild(label);
    }
    viewport.appendChild(guides);
  }

  function renderGraph(root, graph) {
    const canvas = root.querySelector('.atlas-v2__canvas');
    if (matchMedia('(max-width: 900px)').matches) {
      canvas.innerHTML = mobileGraphMarkup(graph);
      focusOrigin = null;
      return;
    }

    if (!canvas.querySelector('svg')) {
      canvas.innerHTML = `
        <svg viewBox="0 0 900 620" role="group" aria-label="知识标签关系图"></svg>
        <div class="atlas-v2__controls" aria-label="星图控制">
          <button type="button" data-action="zoom-out" title="缩小" aria-label="缩小知识网络">${icon('minus')}</button>
          <button type="button" data-action="zoom-in" title="放大" aria-label="放大知识网络">${icon('plus')}</button>
          <button type="button" data-action="reset-view" title="重置视图" aria-label="重置知识网络视图">${icon('reset')}</button>
        </div>`;
    }
    const svg = canvas.querySelector('svg');
    const previousPositions = new Map([...svg.querySelectorAll('.atlas-v2__node')].map(node => [
      node.dataset.tag,
      { x: Number(node.dataset.x), y: Number(node.dataset.y) }
    ]));
    svg.replaceChildren();
    const positions = layoutGraph(graph);
    const viewport = svgElement('g', { class: 'atlas-v2__viewport' });
    svg.appendChild(viewport);

    const defs = svgElement('defs');
    defs.innerHTML = `
      <filter id="atlas-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="7" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <radialGradient id="atlas-core"><stop offset="0" stop-color="var(--atlas-core-a)"/><stop offset="1" stop-color="var(--atlas-core-b)"/></radialGradient>
      <marker id="atlas-tree-arrow" viewBox="0 0 8 8" refX="6.4" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 1 L 7 4 L 0 7 Z"/></marker>
    `;
    viewport.appendChild(defs);

    if (!state.tag) {
      const rings = svgElement('g', { class: 'atlas-v2__rings', 'aria-hidden': 'true' });
      [118, 226, 350].forEach((radius, index) => rings.appendChild(svgElement('ellipse', { cx: 450, cy: 310, rx: radius, ry: radius * (index === 2 ? 0.71 : 0.72), class: `atlas-v2__ring atlas-v2__ring--${index}` })));
      viewport.appendChild(rings);
    } else {
      appendHierarchyGuides(viewport, graph, positions);
    }

    const edgesGroup = svgElement('g', { class: 'atlas-v2__edges', 'aria-hidden': 'true' });
    const busByTarget = appendDirectChildBus(edgesGroup, graph, positions);
    graph.edges.forEach(edge => {
      const a = positions.get(edge.source);
      const b = positions.get(edge.target);
      if (!a || !b) return;
      const renderedEdge = busByTarget.has(edge.target) && edge.source === state.tag
        ? { ...edge, busY: busByTarget.get(edge.target) }
        : edge;
      const line = svgElement('path', {
        d: edgePath(renderedEdge, a, b),
        class: `atlas-v2__edge atlas-v2__edge--${edge.type} atlas-v2__edge--kind-${edge.kind || edge.type} atlas-v2__edge--hop-${edge.hop || 1}`,
        'data-source': edge.source,
        'data-target': edge.target,
        pathLength: '1'
      });
      if (edge.type === 'tree') line.setAttribute('marker-end', 'url(#atlas-tree-arrow)');
      line.style.setProperty('--edge-weight', Math.min(3, edge.weight || 1));
      edgesGroup.appendChild(line);
    });
    viewport.appendChild(edgesGroup);

    if (!state.tag) {
      const core = svgElement('g', { class: 'atlas-v2__core', transform: 'translate(450 310)', 'aria-hidden': 'true' });
      core.innerHTML = '<circle r="72"/><text y="-12">KNOWLEDGE</text><text y="10">ATLAS</text><text class="atlas-v2__core-cn" y="40">知识星图</text>';
      viewport.appendChild(core);
    } else {
      const wave = svgElement('g', { class: 'atlas-v2__focus-wave', 'aria-hidden': 'true' });
      const focusPoint = positions.get(state.tag);
      wave.appendChild(svgElement('circle', { cx: focusPoint.x, cy: focusPoint.y, r: 34 }));
      viewport.appendChild(wave);
    }

    const nodesGroup = svgElement('g', { class: 'atlas-v2__nodes' });
    graph.nodes.forEach((item, index) => {
      const data = concepts.get(item.slug);
      const point = positions.get(item.slug);
      if (!data || !point) return;
      const count = conceptUsage(item.slug);
      const visibleChildren = graph.nodes.filter(node => concepts.get(node.slug)?.parent === item.slug).length;
      const hiddenChildren = Math.max(0, data.children.length - visibleChildren);
      const group = svgElement('g', {
        class: `atlas-v2__node atlas-v2__node--${item.role} atlas-v2__node--hop-${item.hop ?? 1} atlas-v2__node--level-${Math.abs(item.level ?? item.hop ?? 1)} ${item.slug === state.tag ? 'is-selected' : ''}`,
        transform: `translate(${point.x} ${point.y})`,
        'data-tag': item.slug,
        'data-x': point.x,
        'data-y': point.y,
        tabindex: '0', role: 'button',
        'aria-label': `${data.name}，${count} 篇文章${hiddenChildren ? `，可继续展开 ${hiddenChildren} 项` : ''}`
      });
      group.style.setProperty('--node-delay', `${Math.min(index * 40, 360)}ms`);
      const previous = previousPositions.get(item.slug) || (item.slug === state.tag ? focusOrigin : null);
      if (previous && Number.isFinite(previous.x) && Number.isFinite(previous.y)) {
        group.classList.add('is-repositioned');
        group.style.setProperty('--node-shift-x', `${previous.x - point.x}px`);
        group.style.setProperty('--node-shift-y', `${previous.y - point.y}px`);
      }
      const width = labelWidth(item.slug);
      group.innerHTML = `<title>${escapeHtml(data.name)}</title><g class="atlas-v2__node-motion"><rect x="${-width / 2}" y="-24" width="${width}" height="48" rx="20"/><g class="atlas-v2__node-label"><text text-anchor="middle" y="${hiddenChildren ? -2 : 5}"><tspan>${escapeHtml(nodeLabel(data.name))}</tspan><tspan class="atlas-v2__count"> ${count}</tspan></text>${hiddenChildren ? `<text class="atlas-v2__node-more" text-anchor="middle" y="15">更多 ${hiddenChildren}</text>` : ''}</g></g>`;
      nodesGroup.appendChild(group);
    });
    viewport.appendChild(nodesGroup);
    focusOrigin = null;
    applyViewport(root);
    bindGraphInteractions(root, graph, positions);
  }

  function applyViewport(root) {
    const viewport = root.querySelector('.atlas-v2__viewport');
    if (!viewport) return;
    viewport.style.removeProperty('transform');
    viewport.setAttribute('transform', `translate(${state.panX} ${state.panY}) scale(${state.zoom})`);
  }

  function bindGraphInteractions(root, graph) {
    const canvas = root.querySelector('.atlas-v2__canvas');
    const svg = canvas.querySelector('svg');
    const viewport = svg.querySelector('.atlas-v2__viewport');
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;

    svg.onpointerdown = event => {
      if (event.target.closest?.('.atlas-v2__node')) return;
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      originX = state.panX;
      originY = state.panY;
      svg.setPointerCapture(event.pointerId);
      canvas.classList.add('is-dragging');
    };
    svg.onpointermove = event => {
      if (!dragging) return;
      state.panX = originX + (event.clientX - startX) / state.zoom;
      state.panY = originY + (event.clientY - startY) / state.zoom;
      applyViewport(root);
    };
    const finishDrag = event => {
      dragging = false;
      canvas.classList.remove('is-dragging');
      if (event?.pointerId !== undefined) {
        try { svg.releasePointerCapture(event.pointerId); } catch (_) {}
      }
    };
    svg.onpointerup = finishDrag;
    svg.onpointercancel = finishDrag;
    svg.onlostpointercapture = finishDrag;
    svg.onwheel = event => {
      event.preventDefault();
      state.zoom = Math.max(0.65, Math.min(1.75, state.zoom * (event.deltaY > 0 ? 0.9 : 1.1)));
      applyViewport(root);
    };
    svg.onmousemove = event => {
      if (reduceMotion || dragging || !graphVisible) return;
      cancelAnimationFrame(graphFrame);
      graphFrame = requestAnimationFrame(() => {
        const rect = svg.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width - 0.5) * 5;
        const y = ((event.clientY - rect.top) / rect.height - 0.5) * 4;
        viewport.style.setProperty('--atlas-drift-x', `${x}px`);
        viewport.style.setProperty('--atlas-drift-y', `${y}px`);
      });
    };

    canvas.onkeydown = event => {
      if (event.target !== canvas) return;
      const panStep = 34 / state.zoom;
      if (event.key === 'ArrowLeft') state.panX += panStep;
      else if (event.key === 'ArrowRight') state.panX -= panStep;
      else if (event.key === 'ArrowUp') state.panY += panStep;
      else if (event.key === 'ArrowDown') state.panY -= panStep;
      else if (event.key === '+' || event.key === '=') state.zoom = Math.min(1.75, state.zoom + 0.15);
      else if (event.key === '-' || event.key === '_') state.zoom = Math.max(0.65, state.zoom - 0.15);
      else if (event.key === 'Home' || event.key === '0') resetView(root);
      else return;
      event.preventDefault();
      applyViewport(root);
    };

    root.querySelectorAll('.atlas-v2__node').forEach(node => {
      const activate = () => {
        if (state.tag === node.dataset.tag) return;
        focusOrigin = {
          x: Number(node.dataset.x || 450),
          y: Number(node.dataset.y || 310)
        };
        state.tag = node.dataset.tag;
        state.panX = 0;
        state.panY = 0;
        state.zoom = 1;
        writeUrl('push');
        render(root);
      };
      node.addEventListener('click', activate);
      node.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); }
      });
      const showRelated = () => {
        const tag = node.dataset.tag;
        clearTimeout(node._atlasHoverTimer);
        node._atlasHoverTimer = setTimeout(() => {
          if (hoverTag === tag) return;
          hoverTag = tag;
          root.querySelectorAll('.atlas-v2__edge').forEach(edge => {
            edge.classList.toggle('is-emphasized', edge.dataset.source === tag || edge.dataset.target === tag);
            edge.classList.toggle('is-muted', edge.dataset.source !== tag && edge.dataset.target !== tag);
          });
          const relatedPosts = postsForConcept(tag, graph.articles);
          renderResults(root, graph, relatedPosts.length ? relatedPosts : graph.articles, tag, true);
        }, 72);
      };
      const cancelRelatedIntent = () => clearTimeout(node._atlasHoverTimer);
      node.addEventListener('mouseenter', showRelated);
      node.addEventListener('focus', showRelated);
      node.addEventListener('mouseleave', cancelRelatedIntent);
      node.addEventListener('blur', cancelRelatedIntent);
    });
  }

  function resultMarkup(graph, list, hoverTag) {
    const directSet = new Set(graph.directPosts.map(post => post.url));
    const tagLabel = hoverTag ? concepts.get(hoverTag)?.name : '';
    return `
      <header><div><span>${tagLabel ? '关联记录' : '匹配记录'}</span><strong class="${tagLabel ? '' : 'is-placeholder'}" ${tagLabel ? '' : 'aria-hidden="true"'}>${tagLabel ? escapeHtml(tagLabel) : '当前标签'}</strong></div><b>${list.length} RESULTS</b></header>
      <div class="atlas-v2__result-list">
        ${list.length ? list.map((post, index) => `
          <a href="${escapeHtml(post.url)}" class="atlas-v2__result ${directSet.has(post.url) ? 'is-direct' : ''}">
            <span class="atlas-v2__result-index">${String(index + 1).padStart(2, '0')}</span>
            <span class="atlas-v2__result-copy">
              <strong>${escapeHtml(post.title)}</strong>
              <small>${escapeHtml(post.categories[0] || '记录')}${directSet.has(post.url) && state.tag ? ' · 层级命中' : ''}</small>
              <p>${escapeHtml(post.content.slice(0, 76) || post.tags.join(' · '))}</p>
            </span>
            <span class="atlas-v2__result-arrow">${icon('chevron')}</span>
          </a>`).join('') : '<p class="atlas-v2__empty">当前坐标没有匹配记录。</p>'}
      </div>
    `;
  }

  async function renderResults(root, graph, list = graph.articles, hoverTag = '', animate = false) {
    const result = root.querySelector('.atlas-v2__results');
    if (!result) return;
    const revision = ++resultsRevision;
    result.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
    const markup = resultMarkup(graph, list, hoverTag);
    const hasCurrent = result.childElementCount > 0;
    if (!animate || reduceMotion || !hasCurrent) {
      result.innerHTML = markup;
      return;
    }
    result.innerHTML = markup;
    const transition = result.animate([
      { opacity: 0.72, transform: 'translateY(4px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], {
      duration: 190,
      easing: 'cubic-bezier(.16,1,.3,1)',
      fill: 'both'
    });
    await transition.finished.catch(() => {});
    if (revision !== resultsRevision) transition.cancel();
  }

  function render(root) {
    hoverTag = '';
    renderRail(root);
    renderFacets(root);
    renderTrail(root);
    const graph = neighborhood();
    renderGraph(root, graph);
    renderResults(root, graph);
  }

  function resetView(root) {
    state.zoom = 1;
    state.panX = 0;
    state.panY = 0;
    applyViewport(root);
  }

  function bindUi(root) {
    const input = root.querySelector('.atlas-v2__search input');
    const clear = root.querySelector('[data-action="clear-search"]');
    let queryTimer;
    input.addEventListener('input', () => {
      clear.hidden = !input.value;
      clearTimeout(queryTimer);
      queryTimer = setTimeout(() => {
        state.query = input.value.trim();
        render(root);
      }, 140);
    });

    root.addEventListener('click', event => {
      const category = event.target.closest('[data-category]');
      const facet = event.target.closest('[data-facet]');
      const action = event.target.closest('[data-action]');
      const trailTag = event.target.closest('.atlas-v2__trail [data-tag]');
      const compactTag = event.target.closest('.atlas-v2__mobile-node[data-tag]');

      if (category) {
        state.category = category.dataset.category;
        state.tag = '';
        resetView(root);
        writeUrl('push');
        render(root);
      } else if (facet) {
        state.facet = state.facet === facet.dataset.facet ? '' : facet.dataset.facet;
        writeUrl('replace');
        render(root);
      } else if (compactTag?.dataset.tag || trailTag?.dataset.tag) {
        state.tag = compactTag?.dataset.tag || trailTag.dataset.tag;
        resetView(root);
        writeUrl('push');
        render(root);
      } else if (action) {
        const type = action.dataset.action;
        if (type === 'zoom-in') state.zoom = Math.min(1.75, state.zoom + 0.15);
        if (type === 'zoom-out') state.zoom = Math.max(0.65, state.zoom - 0.15);
        if (type === 'reset-view') resetView(root);
        if (type === 'overview') { state.tag = ''; resetView(root); writeUrl('push'); render(root); }
        if (type === 'clear-search') { input.value = ''; state.query = ''; clear.hidden = true; render(root); }
        if (type === 'reset-all') {
          Object.assign(state, { category: '', tag: '', facet: '', query: '', zoom: 1, panX: 0, panY: 0 });
          input.value = '';
          writeUrl('push');
          render(root);
        }
        applyViewport(root);
      }
    });

    const signal = lifecycleController.signal;
    window.addEventListener('popstate', () => { parseUrlState(); resetView(root); render(root); }, { signal });
    document.addEventListener('visibilitychange', () => { graphVisible = document.visibilityState === 'visible'; }, { signal });
    const observer = new IntersectionObserver(entries => { graphVisible = entries.some(entry => entry.isIntersecting); }, { threshold: 0.05 });
    observer.observe(root);
    signal.addEventListener('abort', () => observer.disconnect(), { once: true });
    const compactQuery = matchMedia('(max-width: 900px)');
    const rerenderForLayout = () => render(root);
    compactQuery.addEventListener('change', rerenderForLayout);
    signal.addEventListener('abort', () => compactQuery.removeEventListener('change', rerenderForLayout), { once: true });
  }

  async function mount() {
    if (mounted) return;
    const host = findHost();
    if (!host) return;
    mounted = true;
    reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    host.loader.textContent = '正在整理知识坐标…';

    try {
      const [taxonomyResponse, relationResponse, indexResponse] = await Promise.all([
        fetch('/data/knowledge-taxonomy-v2.json', { cache: 'no-store' }),
        fetch('/data/knowledge-relations.json', { cache: 'no-store' }),
        fetch('/data/knowledge-index-v1.json', { cache: 'no-store' })
      ]);
      if (!taxonomyResponse.ok || !relationResponse.ok || !indexResponse.ok) {
        throw new Error('索引数据加载失败');
      }
      taxonomy = await taxonomyResponse.json();
      relationConfig = await relationResponse.json();
      flattenTaxonomy();
      posts = parseKnowledgeIndex(await indexResponse.json());
      parseUrlState();
      const root = buildShell(host);
      lifecycleController?.abort();
      lifecycleController = new AbortController();
      bindUi(root);
      render(root);
      requestAnimationFrame(() => root.classList.add('is-ready'));
    } catch (error) {
      host.loader.innerHTML = `<strong>知识索引暂时不可用</strong><br><span>${escapeHtml(error.message)}</span>`;
      mounted = false;
    }
  }

  function scheduleMount() {
    lifecycleController?.abort();
    lifecycleController = undefined;
    cancelAnimationFrame(graphFrame);
    mounted = false;
    const host = findHost();
    if (!host) return;
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          observer.disconnect();
          mount();
        }
      }, { rootMargin: '240px' });
      observer.observe(host.loader);
    } else {
      mount();
    }
  }

  document.addEventListener('DOMContentLoaded', scheduleMount);
  document.addEventListener('pjax:complete', scheduleMount);
})();
