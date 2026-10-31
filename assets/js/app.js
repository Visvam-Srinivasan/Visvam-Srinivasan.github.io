const app = document.querySelector("#app");
const navigation = document.querySelector(".navigation");
const menuToggle = document.querySelector(".menu-toggle");
const themeToggle = document.querySelector(".theme-toggle");
const currentYear = document.querySelector("#current-year");
const baseUrl = new URL("../../", import.meta.url);
const paths = {
  site: "data/site.json",
  content: "data/content.json",
  resume: "data/resume.json",
  projects: "data/projects.json",
  posts: "data/posts.json",
};

let site;
let copy;
let resume;
let projects;
let posts;
let activeRender = 0;

currentYear.textContent = new Date().getFullYear();

function setTheme(theme, persist = false) {
  const isDark = theme === "dark";
  const themeCopy = isDark ? copy.theme.switchToLight : copy.theme.switchToDark;
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  themeToggle.setAttribute("aria-label", themeCopy);
  themeToggle.title = themeCopy;
  themeToggle.querySelector('[aria-hidden="true"]').textContent = isDark ? "☀" : "☾";
  document.querySelector('meta[name="theme-color"]').content = isDark ? "#171b24" : "#f5f1e7";
  if (persist) {
    try {
      localStorage.setItem("portfolio-theme", isDark ? "dark" : "light");
    } catch (error) {
      console.error(error);
    }
  }
}

function initializeTheme() {
  let savedTheme;
  try {
    savedTheme = localStorage.getItem("portfolio-theme");
  } catch (error) {
    console.error(error);
  }
  const preferredTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  setTheme(savedTheme === "dark" || savedTheme === "light" ? savedTheme : preferredTheme);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function safeUrl(value = "") {
  const url = String(value).trim();
  if (/^(https?:|mailto:|tel:|\/|\.\/|\.\.\/|#)/i.test(url) ||
      /^[a-z0-9][a-z0-9._/-]*(?:[?#][^\s]*)?$/i.test(url)) return url;
  return "";
}

function linkAttributes(value, external = false) {
  const url = safeUrl(value);
  if (!url) return "";
  const isExternal = /^https?:/i.test(url) || external;
  return `href="${escapeHtml(url)}"${isExternal ? ' target="_blank" rel="noreferrer"' : ""}`;
}

function inlineMarkdown(text) {
  const pattern =
    /(!?)\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|`([^`]+)`/g;
  let html = "";
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    html += escapeHtml(text.slice(lastIndex, match.index));
    if (match[1] === "!") {
      const source = safeUrl(match[3]);
      html += source
        ? `<img src="${escapeHtml(source)}" alt="${escapeHtml(match[2])}" loading="lazy">`
        : escapeHtml(match[2]);
    } else if (match[2] !== undefined) {
      const attributes = linkAttributes(match[3]);
      html += attributes ? `<a ${attributes}>${escapeHtml(match[2])}</a>` : escapeHtml(match[2]);
    } else if (match[4] || match[5]) {
      html += `<strong>${escapeHtml(match[4] || match[5])}</strong>`;
    } else if (match[6] || match[7]) {
      html += `<em>${escapeHtml(match[6] || match[7])}</em>`;
    } else {
      html += `<code>${escapeHtml(match[8])}</code>`;
    }
    lastIndex = match.index + match[0].length;
  }
  return html + escapeHtml(text.slice(lastIndex));
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let paragraph = [];
  let listType = "";
  let quote = [];
  let code = [];
  let inCode = false;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push(`<p>${paragraph.map(inlineMarkdown).join("<br>")}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (listType) blocks.push(`</${listType}>`);
    listType = "";
  };
  const flushQuote = () => {
    if (quote.length) blocks.push(`<blockquote>${quote.map(inlineMarkdown).join("<br>")}</blockquote>`);
    quote = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      flushParagraph();
      closeList();
      flushQuote();
      if (inCode) {
        blocks.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        code = [];
      }
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      code.push(line);
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    const listItem = line.match(/^\s*(?:[-*+]|\d+\.)\s+(.+)$/);
    const quoteLine = line.match(/^\s*>\s?(.*)$/);

    if (heading) {
      flushParagraph();
      closeList();
      flushQuote();
      const level = heading[1].length;
      blocks.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
    } else if (listItem) {
      flushParagraph();
      flushQuote();
      const nextListType = /^\s*\d+\./.test(line) ? "ol" : "ul";
      if (listType && listType !== nextListType) closeList();
      if (!listType) {
        listType = nextListType;
        blocks.push(`<${listType}>`);
      }
      blocks.push(`<li>${inlineMarkdown(listItem[1])}</li>`);
    } else if (quoteLine) {
      flushParagraph();
      closeList();
      quote.push(quoteLine[1]);
    } else if (!line.trim()) {
      flushParagraph();
      closeList();
      flushQuote();
    } else {
      closeList();
      flushQuote();
      paragraph.push(line);
    }
  }
  flushParagraph();
  closeList();
  flushQuote();
  if (inCode && code.length) blocks.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
  return blocks.join("\n");
}

async function loadJson(path) {
  const response = await fetch(new URL(path, baseUrl));
  if (!response.ok) throw new Error(`${response.status}: ${path}`);
  return response.json();
}

function copyText(value, replacements = {}) {
  return Object.entries(replacements).reduce(
    (text, [key, replacement]) => text.replaceAll(`{{${key}}}`, replacement),
    value,
  );
}

function initializeShell() {
  document.querySelectorAll("[data-copy]").forEach((node) => {
    const value = node.dataset.copy.split(".").reduce((object, key) => object[key], copy);
    node.textContent = value;
  });
  document.querySelectorAll(".navigation [data-route]").forEach((link) => {
    link.querySelector("[data-route-label]").textContent = copy.navigation[link.dataset.route];
  });
  document.querySelectorAll('[data-site="name"]').forEach((node) => {
    node.textContent = site.name;
  });
  const homeLabel = copyText(copy.navigation.homeLabel, { name: site.name });
  document.querySelector(".wordmark-mark").textContent = (site.name || "").trim().charAt(0).toUpperCase();
  document.querySelector(".wordmark").setAttribute("aria-label", homeLabel);
  document.querySelector(".site-footer > span:nth-child(2)").textContent = copy.footer.tagline;
  document.querySelector(".site-footer a").textContent = `${copy.footer.backToTop} ↑`;
  document.querySelector(".menu-toggle").setAttribute("aria-label", copy.navigation.openMenu);
  document.querySelector(".navigation").setAttribute("aria-label", copy.navigation.mainLabel);
  document.querySelector('meta[name="description"]').content = copy.metaDescription;
  document.documentElement.lang = copy.locale;
  document.title = `${site.name} — ${copy.siteTitle}`;
}

function projectCard(project) {
  const image = project.image
    ? `<img src="${escapeHtml(safeUrl(project.image))}" alt="${escapeHtml(project.imageAlt || project.title)}" loading="lazy">`
    : `<span class="cover-monogram" aria-hidden="true">${escapeHtml(project.title.slice(0, 1))}</span>`;
  const isFeatured = contentTags(project).some((tag) => tag.toLocaleLowerCase() === "featured");
  return `
    <article class="project-card${isFeatured ? " is-featured-project" : ""}" data-note-card data-search="${escapeHtml(`${project.title} ${project.description} ${project.category} ${(project.tags || []).join(" ")}`.toLowerCase())}" data-tags="${escapeHtml(JSON.stringify(contentTags(project).map((tag) => tag.toLocaleLowerCase())))}">
      <a class="project-cover-link" href="#/projects/${encodeURIComponent(project.slug)}"><div class="project-cover cover-${escapeHtml(project.accent || "peach")}">${image}<span class="cover-arrow" aria-hidden="true">↗</span></div></a>
      <div class="card-meta"><span>${escapeHtml(project.category)}</span><span>${(project.tags || []).slice(0, 2).map(escapeHtml).join(" · ")}</span></div>
      <h3><a href="#/projects/${encodeURIComponent(project.slug)}">${escapeHtml(project.title)}</a></h3>
      <p>${escapeHtml(project.description)}</p>
      ${renderTagChips(project.tags)}
    </article>`;
}

function postCard(post) {
  return `
    <article class="post-card" data-note-card data-search="${escapeHtml(`${post.title} ${post.excerpt} ${post.category} ${(post.tags || []).join(" ")}`.toLowerCase())}" data-tags="${escapeHtml(JSON.stringify(contentTags(post).map((tag) => tag.toLocaleLowerCase())))}">
      <span class="post-date">${escapeHtml(post.category)} <span aria-hidden="true">·</span> ${formatDate(post.date)}</span>
      <h3><a href="#/blog/${encodeURIComponent(post.slug)}">${escapeHtml(post.title)} <span aria-hidden="true">↗</span></a></h3>
      <p>${escapeHtml(post.excerpt)}</p>
      <span class="read-time">${escapeHtml(post.readTime || "")}</span>
      ${renderTagChips(post.tags)}
    </article>`;
}

function renderTagChips(tags = []) {
  if (!tags.length) return "";
  return `<div class="tag-chips">${tags.map((tag) => `<button class="tag-chip${tag.toLocaleLowerCase() === "featured" ? " is-featured-tag" : ""}" type="button" data-select-tag="${escapeHtml(tag)}">#${escapeHtml(tag)}</button>`).join("")}</div>`;
}

function contentTags(item) {
  return [...new Set((item.tags || []).map((tag) => String(tag).trim()).filter(Boolean))];
}

function contentHref(item) {
  const section = item.type === "project" ? "projects" : "blog";
  return `#/${section}/${encodeURIComponent(item.slug)}`;
}

function renderGraph(items, label, linkTags = false) {
  const tagMap = new Map();
  items.forEach((item) => contentTags(item).forEach((tag) => {
    const key = tag.toLocaleLowerCase();
    if (!tagMap.has(key)) tagMap.set(key, { label: tag, items: [] });
    const tagItems = tagMap.get(key).items;
    if (!tagItems.some((entry) => `${entry.type}:${entry.slug}` === `${item.type}:${item.slug}`)) {
      tagItems.push(item);
    }
  }));
  const tags = [...tagMap.values()].sort((a, b) => a.label.localeCompare(b.label));
  if (!items.length) return `<div class="graph-empty">${escapeHtml(copy.graph.empty)}</div>`;

  const columns = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(tags.length))));
  const clusterWidth = 360;
  const clusterHeight = 330;
  const width = Math.max(760, columns * clusterWidth);
  const rows = Math.ceil(tags.length / columns);
  const height = Math.max(520, rows * clusterHeight);
  const edges = [];
  const tagNodes = [];
  const contentNodes = [];
  const tagPositions = new Map();
  const layoutNodes = [];

  tags.forEach(({ label: tag, items: related }, tagIndex) => {
    const column = tagIndex % columns;
    const row = Math.floor(tagIndex / columns);
    const center = {
      x: column * clusterWidth + clusterWidth / 2,
      y: row * clusterHeight + clusterHeight / 2,
    };
    const tagId = tag.toLocaleLowerCase();
    const featuredTag = tagId === "featured";
    tagPositions.set(tagId, center);
    layoutNodes.push({
      key: `tag:${tagId}`,
      type: "tag",
      x: center.x,
      y: center.y,
      anchorX: center.x,
      anchorY: center.y,
      radius: 45,
    });
    const tagNode = `<g class="graph-tag-node${featuredTag ? " is-featured" : ""}" data-graph-node data-graph-key="tag:${escapeHtml(tagId)}" data-node-x="${center.x}" data-node-y="${center.y}" data-tag-node="${escapeHtml(tag)}" role="button" tabindex="0" aria-label="${escapeHtml(copyText(copy.graph.tagFilterLabel, { tag }))}" transform="translate(${center.x} ${center.y})"><circle r="29"/><text class="graph-hash" y="5">#</text><text class="graph-tag-label" y="47">${escapeHtml(tag)}</text></g>`;
    tagNodes.push(linkTags ? `<a class="graph-tag-link" href="#/graph?tag=${encodeURIComponent(tag)}" aria-label="${escapeHtml(copyText(copy.graph.tagExploreLabel, { tag }))}">${tagNode}</a>` : tagNode);
  });

  const uniqueItems = [...new Map(items.map((item) => [`${item.type}:${item.slug}`, item])).values()];
  const positionedItems = uniqueItems.map((item) => {
    const id = `${item.type}:${item.slug}`;
    const relatedTags = contentTags(item)
      .map((tag) => tagPositions.get(tag.toLocaleLowerCase()))
      .filter(Boolean);
    if (!relatedTags.length) return { item, id, point: { x: width / 2, y: height / 2 } };
    const point = relatedTags.reduce((center, position) => ({
      x: center.x + position.x / relatedTags.length,
      y: center.y + position.y / relatedTags.length,
    }), { x: 0, y: 0 });
    const angle = (uniqueItems.indexOf(item) + 1) * 2.399963229728653;
    const offset = 72 + Math.sqrt(uniqueItems.indexOf(item)) * 14;
    return {
      item,
      id,
      point: { x: point.x + Math.cos(angle) * offset, y: point.y + Math.sin(angle) * offset },
    };
  });

  positionedItems.forEach(({ item, id, point }) => {
    const nodePoint = point;
    const featured = item.type === "project" && contentTags(item).some((tag) => tag.toLocaleLowerCase() === "featured");
    const title = item.title.length > 24 ? `${item.title.slice(0, 23).trimEnd()}…` : item.title;
    const radius = Math.max(37, Math.min(78, title.length * 3.2 + 12));
    layoutNodes.push({
      key: `item:${id}`,
      type: "item",
      x: nodePoint.x,
      y: nodePoint.y,
      anchorX: nodePoint.x,
      anchorY: nodePoint.y,
      radius,
    });

    contentTags(item).forEach((tag) => {
      const tagPoint = tagPositions.get(tag.toLocaleLowerCase());
      if (tagPoint) {
        edges.push({
          id,
          from: `tag:${tag.toLocaleLowerCase()}`,
          to: `item:${id}`,
          featured,
        });
      }
    });
    contentNodes.push(`<a class="graph-item-node graph-item-${item.type}${featured ? " is-featured" : ""}" data-graph-node data-graph-key="item:${escapeHtml(id)}" data-node-x="${nodePoint.x}" data-node-y="${nodePoint.y}" transform="translate(${nodePoint.x} ${nodePoint.y})" data-graph-item="${escapeHtml(id)}" data-search="${escapeHtml(`${item.title} ${item.description || item.excerpt || ""} ${contentTags(item).join(" ")}`.toLocaleLowerCase())}" data-tags="${escapeHtml(JSON.stringify(contentTags(item).map((tag) => tag.toLocaleLowerCase())))}" href="${contentHref(item)}" aria-label="${escapeHtml(copyText(copy.graph.openItemLabel, { title: item.title }))}"><circle r="${featured ? 9 : 7}"/><text x="0" y="22" text-anchor="middle">${escapeHtml(title)}</text><title>${escapeHtml(item.title)} · ${contentTags(item).map(escapeHtml).join(", ")}</title></a>`);
  });

  optimizeGraphLayout(layoutNodes, items, width, height);
  layoutNodes.forEach((node) => {
    const [kind, ...identity] = node.key.split(":");
    const key = identity.join(":");
    const markup = kind === "tag" ? tagNodes : contentNodes;
    const index = kind === "tag"
      ? tags.findIndex(({ label: tag }) => tag.toLocaleLowerCase() === key)
      : positionedItems.findIndex(({ id }) => id === key);
    if (index >= 0) {
      markup[index] = markup[index]
        .replace(/data-node-x="[^"]+"/, `data-node-x="${node.x}"`)
        .replace(/data-node-y="[^"]+"/, `data-node-y="${node.y}"`)
        .replace(/transform="translate\([^"]+\)"/, `transform="translate(${node.x} ${node.y})"`);
    }
  });
  const nodeByKey = new Map(layoutNodes.map((node) => [node.key, node]));
  const edgeMarkup = edges.map(({ id, from, to, featured }) => {
    const source = nodeByKey.get(from);
    const target = nodeByKey.get(to);
    return `<line class="graph-edge${featured ? " is-featured" : ""}" data-edge-note="${escapeHtml(id)}" data-edge-from="${escapeHtml(from)}" data-edge-to="${escapeHtml(to)}" x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}"/>`;
  }).join("");
  const graphId = label.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `<svg class="graph-svg" data-graph-id="${graphId}" viewBox="0 0 ${width} ${height}" role="group" aria-label="${escapeHtml(copyText(copy.graph.description, { label }))}"><g aria-hidden="true">${edgeMarkup}</g>${tagNodes.join("")}${contentNodes.join("")}</svg>`;
}

function optimizeGraphLayout(nodes, items, width, height) {
  if (nodes.length < 2) return;
  const nodeByKey = new Map(nodes.map((node) => [node.key, node]));
  const links = items.flatMap((item) => contentTags(item).map((tag) => ({
    from: `tag:${tag.toLocaleLowerCase()}`,
    to: `item:${item.type}:${item.slug}`,
  }))).filter((link) => nodeByKey.has(link.from) && nodeByKey.has(link.to));
  const cellSize = 190;
  const iterations = Math.min(180, Math.max(70, Math.ceil(9000 / nodes.length)));
  const orientation = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const segmentsCross = (first, second) => {
    if (first.from === second.from || first.to === second.to || first.from === second.to || first.to === second.from) return false;
    const a = nodeByKey.get(first.from);
    const b = nodeByKey.get(first.to);
    const c = nodeByKey.get(second.from);
    const d = nodeByKey.get(second.to);
    return orientation(a, b, c) * orientation(a, b, d) < 0 &&
      orientation(c, d, a) * orientation(c, d, b) < 0;
  };
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const forces = new Map(nodes.map((node) => [node.key, { x: 0, y: 0 }]));
    const buckets = new Map();
    nodes.forEach((node) => {
      const cellX = Math.floor(node.x / cellSize);
      const cellY = Math.floor(node.y / cellSize);
      const bucketKey = `${cellX}:${cellY}`;
      if (!buckets.has(bucketKey)) buckets.set(bucketKey, []);
      buckets.get(bucketKey).push(node);
    });
    nodes.forEach((node) => {
      const cellX = Math.floor(node.x / cellSize);
      const cellY = Math.floor(node.y / cellSize);
      for (let x = cellX - 1; x <= cellX + 1; x += 1) {
        for (let y = cellY - 1; y <= cellY + 1; y += 1) {
          for (const other of buckets.get(`${x}:${y}`) || []) {
            if (other.key <= node.key) continue;
            const dx = node.x - other.x;
            const dy = node.y - other.y;
            const distance = Math.max(1, Math.hypot(dx, dy));
            const minimum = node.radius + other.radius + 22;
            const desired = Math.max(minimum, 145);
            if (distance >= desired) continue;
            const strength = distance < minimum ? 0.32 : 0.035;
            const magnitude = (desired - distance) * strength / distance;
            const force = forces.get(node.key);
            const opposite = forces.get(other.key);
            force.x += dx * magnitude;
            force.y += dy * magnitude;
            opposite.x -= dx * magnitude;
            opposite.y -= dy * magnitude;
          }
        }
      }
    });
    links.forEach(({ from, to }) => {
      const source = nodeByKey.get(from);
      const target = nodeByKey.get(to);
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const magnitude = (distance - 135) * 0.006 / distance;
      forces.get(from).x += dx * magnitude;
      forces.get(from).y += dy * magnitude;
      forces.get(to).x -= dx * magnitude;
      forces.get(to).y -= dy * magnitude;
    });

    if (links.length <= 240 && iteration % 3 === 0) {
      for (let firstIndex = 0; firstIndex < links.length; firstIndex += 1) {
        const first = links[firstIndex];
        const source = nodeByKey.get(first.from);
        const target = nodeByKey.get(first.to);
        for (let secondIndex = firstIndex + 1; secondIndex < links.length; secondIndex += 1) {
          const second = links[secondIndex];
          if (!segmentsCross(first, second)) continue;
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const length = Math.max(1, Math.hypot(dx, dy));
          const direction = first.to.localeCompare(second.to) < 0 ? 1 : -1;
          const force = forces.get(first.to);
          force.x += (-dy / length) * direction * 2;
          force.y += (dx / length) * direction * 2;
        }
      }
    }

    nodes.forEach((node) => {
      const force = forces.get(node.key);
      const anchorStrength = node.type === "tag" ? 0.012 : 0.002;
      force.x += (node.anchorX - node.x) * anchorStrength;
      force.y += (node.anchorY - node.y) * anchorStrength;
      node.vx = ((node.vx || 0) + force.x) * 0.72;
      node.vy = ((node.vy || 0) + force.y) * 0.72;
      node.x = Math.min(width - 95, Math.max(95, node.x + node.vx));
      node.y = Math.min(height - 70, Math.max(55, node.y + node.vy));
    });

  }
}

function updateGraphEdges(graph) {
  const nodes = new Map([...graph.querySelectorAll("[data-graph-node]")].map((node) => [node.dataset.graphKey, node]));
  graph.querySelectorAll("[data-edge-from]").forEach((edge) => {
    const from = nodes.get(edge.dataset.edgeFrom);
    const to = nodes.get(edge.dataset.edgeTo);
    if (!from || !to) return;
    edge.setAttribute("x1", from.dataset.nodeX);
    edge.setAttribute("y1", from.dataset.nodeY);
    edge.setAttribute("x2", to.dataset.nodeX);
    edge.setAttribute("y2", to.dataset.nodeY);
  });
}

function initializeGraphInteractions(root = app) {
  root.querySelectorAll(".graph-svg").forEach((graph) => {
    const layoutKey = `portfolio-graph-layout:${graph.dataset.graphId}`;
    let savedLayout = {};
    try {
      savedLayout = JSON.parse(localStorage.getItem(layoutKey) || "{}");
    } catch (error) {
      console.error(error);
    }

    graph.querySelectorAll("[data-graph-node]").forEach((node) => {
      const saved = savedLayout[node.dataset.graphKey];
      if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.y)) return;
      node.dataset.nodeX = String(saved.x);
      node.dataset.nodeY = String(saved.y);
      node.setAttribute("transform", `translate(${saved.x} ${saved.y})`);
    });
    updateGraphEdges(graph);

    let dragState;
    const toGraphPoint = (event) => {
      const point = graph.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      return point.matrixTransform(graph.getScreenCTM().inverse());
    };
    const saveLayout = () => {
      const layout = Object.fromEntries([...graph.querySelectorAll("[data-graph-node]")].map((node) => [
        node.dataset.graphKey,
        { x: Number(node.dataset.nodeX), y: Number(node.dataset.nodeY) },
      ]));
      try {
        localStorage.setItem(layoutKey, JSON.stringify(layout));
      } catch (error) {
        console.error(error);
      }
    };

    graph.addEventListener("pointerdown", (event) => {
      const node = event.target.closest("[data-graph-node]");
      if (!node || event.button !== 0) return;
      const point = toGraphPoint(event);
      dragState = {
        node,
        pointerId: event.pointerId,
        startX: point.x,
        startY: point.y,
        nodeX: Number(node.dataset.nodeX),
        nodeY: Number(node.dataset.nodeY),
        moved: false,
      };
      node.classList.add("is-dragging");
      node.setPointerCapture(event.pointerId);
    });

    graph.addEventListener("pointermove", (event) => {
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      const point = toGraphPoint(event);
      const deltaX = point.x - dragState.startX;
      const deltaY = point.y - dragState.startY;
      if (!dragState.moved && Math.hypot(deltaX, deltaY) < 3) return;
      dragState.moved = true;
      event.preventDefault();
      const bounds = graph.viewBox.baseVal;
      const x = Math.min(bounds.x + bounds.width - 55, Math.max(bounds.x + 55, dragState.nodeX + deltaX));
      const y = Math.min(bounds.y + bounds.height - 45, Math.max(bounds.y + 45, dragState.nodeY + deltaY));
      dragState.node.dataset.nodeX = String(x);
      dragState.node.dataset.nodeY = String(y);
      dragState.node.setAttribute("transform", `translate(${x} ${y})`);
      updateGraphEdges(graph);
    });

    const finishDrag = (event) => {
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      const { node, moved } = dragState;
      dragState = undefined;
      node.classList.remove("is-dragging");
      if (!moved) return;
      node.dataset.dragged = "true";
      saveLayout();
      setTimeout(() => delete node.dataset.dragged, 0);
    };
    graph.addEventListener("pointerup", finishDrag);
    graph.addEventListener("pointercancel", finishDrag);
    graph.addEventListener("click", (event) => {
      const node = event.target.closest("[data-graph-node]");
      if (!node?.dataset.dragged) return;
      event.preventDefault();
      event.stopPropagation();
      delete node.dataset.dragged;
    }, true);
  });
}

function allGraphItems() {
  return [
    ...posts.map((post) => ({ ...post, type: "blog" })),
    ...projects.map((project) => ({ ...project, type: "project" })),
  ];
}

function collectionExplorer(title, lead, items, collection, initialTag = "") {
  const labels = copy.collections.graph;
  const countLabel = labels.plural;
  const cards = items.map((item) => item.type === "project" ? projectCard(item) : postCard(item)).join("");
  return `
    <section class="page-section collection-page vault-collection" data-collection="${escapeHtml(collection)}">
      <header class="page-heading"><p class="eyebrow"><span class="eyebrow-dot"></span>${escapeHtml(labels.eyebrow)}</p><h1>${escapeHtml(title)}</h1><p class="page-lead">${escapeHtml(lead)}</p></header>
      <div class="collection-toolbar">
        <label class="note-search"><span aria-hidden="true">⌕</span><input type="search" data-note-search placeholder="${escapeHtml(labels.searchPlaceholder)}" aria-label="${escapeHtml(labels.searchLabel)}" value="${escapeHtml(initialTag)}"></label>
        <div class="view-switch" role="group" aria-label="${escapeHtml(labels.viewGroup)}"><button type="button" data-view-mode="graph" aria-pressed="true"><span aria-hidden="true">⌘</span> ${escapeHtml(labels.graphToggle)}</button><button type="button" data-view-mode="list" aria-pressed="false"><span aria-hidden="true">☷</span> ${escapeHtml(labels.listToggle)}</button></div>
      </div>
      <div class="collection-meta"><span data-result-count>${items.length} ${items.length === 1 ? labels.singular : countLabel}</span><span><i class="legend-note"></i> ${escapeHtml(labels.legendNote)} <i class="legend-tag"></i> ${escapeHtml(labels.legendTag)}</span></div>
      <div class="graph-panel" data-graph-panel>${renderGraph(items, title)}<p class="graph-help">${escapeHtml(labels.graphHelp)}</p><p class="graph-no-results" data-graph-no-results hidden>${escapeHtml(labels.graphNoResults)}</p></div>
      <div class="note-list-panel" data-list-panel hidden><div class="note-list-grid">${cards}</div><p class="no-results" data-no-results hidden>${escapeHtml(labels.noResults)}</p></div>
    </section>`;
}

function formatDate(value) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? escapeHtml(value || "")
    : new Intl.DateTimeFormat(copy.locale, { month: "short", year: "numeric" }).format(date);
}

function shell(eyebrow, title, lead, content) {
  return `
    <section class="page-section">
      <div class="page-heading"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${lead ? `<p class="page-lead">${lead}</p>` : ""}</div>
      ${content}
    </section>`;
}

function renderHome() {
  const labels = copy.home;
  const featuredProjects = projects.filter((project) =>
    contentTags(project).some((tag) => tag.toLocaleLowerCase() === "featured"),
  );
  const featuredPosts = (site.featuredPosts || [])
    .map((slug) => posts.find((post) => post.slug === slug))
    .filter(Boolean);
  const graphItems = allGraphItems();
  return `
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow"><span class="status-dot"></span>${escapeHtml(site.availability || site.location)}</p>
        <h1>${escapeHtml(labels.heroTitle)}<br><span>${escapeHtml(labels.heroTitleEmphasis)}</span></h1>
        <p class="hero-intro">${escapeHtml(site.intro)}</p>
        <div class="hero-actions"><a class="button button-dark" href="#/projects">${escapeHtml(labels.primaryAction)} <span aria-hidden="true">↗</span></a><a class="text-link" href="#/about">${escapeHtml(labels.aboutAction)} <span aria-hidden="true">→</span></a></div>
      </div>
      <div class="hero-art" aria-label="${escapeHtml(labels.artLabelDescription)}">
        <div class="art-sun"></div><div class="art-orbit orbit-one"></div><div class="art-orbit orbit-two"></div>
        <div class="art-card"><span class="art-card-label">${escapeHtml(labels.artLabel)}</span><strong>${escapeHtml(site.role)}</strong><span>${escapeHtml(site.location)}</span></div>
        <span class="art-spark spark-one">✳</span><span class="art-spark spark-two">✳</span>
        <span class="art-caption">${escapeHtml(site.artCaption || "")}</span>
      </div>
    </section>
    <section class="home-map">
      <div class="section-heading"><div><p class="eyebrow">${escapeHtml(labels.mapEyebrow)}</p><h2>${escapeHtml(labels.mapTitle)}</h2><p class="page-lead">${escapeHtml(labels.mapLead)}</p></div><a class="text-link" href="#/graph">${escapeHtml(labels.mapAction)} <span aria-hidden="true">↗</span></a></div>
      <div class="graph-panel home-graph">${renderGraph(graphItems, labels.graphLabel, true)}<p class="graph-help">${escapeHtml(labels.graphHelp)}</p></div>
    </section>
    <section class="content-section">
      <div class="section-heading"><div><p class="eyebrow">${escapeHtml(labels.workEyebrow)}</p><h2>${escapeHtml(labels.workTitle)}</h2></div><a class="text-link" href="#/projects">${escapeHtml(labels.projectsAction)} <span aria-hidden="true">→</span></a></div>
      <div class="project-grid">${featuredProjects.map(projectCard).join("")}</div>
    </section>
    <section class="home-note">
      <span class="note-mark" aria-hidden="true">✳</span><p>${escapeHtml(site.belief || "")}</p><a class="text-link" href="#/about">${escapeHtml(labels.beliefAction)} <span aria-hidden="true">→</span></a>
    </section>
    <section class="content-section journal-section">
      <div class="section-heading"><div><p class="eyebrow">${escapeHtml(labels.journalEyebrow)}</p><h2>${escapeHtml(labels.journalTitle)}</h2></div><a class="text-link" href="#/blog">${escapeHtml(labels.blogAction)} <span aria-hidden="true">→</span></a></div>
      <div class="post-grid">${featuredPosts.map(postCard).join("")}</div>
    </section>`;
}

function renderProjects(initialTag = "") {
  const labels = copy.collections.projects;
  const items = projects.map((project) => ({ ...project, type: "project" }));
  const featured = items.filter((project) => contentTags(project).some((tag) => tag.toLocaleLowerCase() === "featured"));
  const other = items.filter((project) => !featured.includes(project));
  const projectList = (entries) => entries.map(projectCard).join("");
  return `
    <section class="page-section projects-workspace split-workspace vault-collection" data-collection="projects" data-graph-visible="true" data-list-visible="true">
      <header class="page-heading"><p class="eyebrow"><span class="eyebrow-dot"></span>${escapeHtml(labels.eyebrow)}</p><h1>${escapeHtml(labels.title)}</h1><p class="page-lead">${escapeHtml(labels.lead)}</p></header>
      <div class="workspace-toolbar">
        <label class="note-search"><span aria-hidden="true">⌕</span><input type="search" data-note-search placeholder="${escapeHtml(labels.searchPlaceholder)}" aria-label="${escapeHtml(labels.searchLabel)}" value="${escapeHtml(initialTag)}"></label>
        <div class="workspace-pane-toggles" role="group" aria-label="${escapeHtml(labels.paneGroup)}">
          <button type="button" data-toggle-pane="graph" aria-pressed="true"><span aria-hidden="true">◉</span> ${escapeHtml(labels.graphToggle)}</button>
          <button type="button" data-toggle-pane="list" aria-pressed="true"><span aria-hidden="true">☷</span> ${escapeHtml(labels.listToggle)}</button>
        </div>
      </div>
      <div class="workspace-panes">
        <section class="workspace-pane graph-pane" data-workspace-pane="graph" aria-label="${escapeHtml(labels.graphRegion)}">
          <header class="workspace-pane-heading"><div><p class="eyebrow">${escapeHtml(labels.graphEyebrow)}</p><h2>${escapeHtml(labels.graphTitle)}</h2></div><button class="pane-minimize" type="button" data-collapse-pane="graph" aria-label="${escapeHtml(labels.minimizeGraph)}" title="${escapeHtml(labels.minimizeGraph)}">−</button></header>
          <div class="pane-graph-wrap" data-graph-panel>${renderGraph(items, labels.graphTitle)}<p class="graph-help">${escapeHtml(labels.graphHelp)}</p><p class="graph-no-results" data-graph-no-results hidden>${escapeHtml(labels.graphNoResults)}</p></div>
          <button class="pane-restore" type="button" data-restore-pane="graph" hidden>＋ ${escapeHtml(labels.restoreGraph)}</button>
        </section>
        <section class="workspace-pane workspace-list-pane" data-workspace-pane="list" aria-label="${escapeHtml(labels.listRegion)}">
          <header class="workspace-pane-heading"><div><p class="eyebrow">${escapeHtml(labels.listEyebrow)}</p><h2>${escapeHtml(labels.listTitle)} <span data-workspace-count>${projects.length}</span></h2></div><button class="pane-minimize" type="button" data-collapse-pane="list" aria-label="${escapeHtml(labels.minimizeList)}" title="${escapeHtml(labels.minimizeList)}">−</button></header>
          <div class="workspace-list-content" data-list-panel>
            ${featured.length ? `<section class="featured-projects"><div class="list-section-heading"><h3>${escapeHtml(labels.featured)}</h3><span>${escapeHtml(copyText(labels.featuredCount, { count: String(featured.length).padStart(2, "0") }))}</span></div><div class="project-card-list">${projectList(featured)}</div></section>` : ""}
            <section class="other-projects"><div class="list-section-heading"><h3>${escapeHtml(labels.other)}</h3><span>${escapeHtml(copyText(labels.otherCount, { count: String(other.length).padStart(2, "0") }))}</span></div><div class="project-card-list">${projectList(other)}</div></section>
            <p class="no-results" data-no-results hidden>${escapeHtml(labels.noResults)}</p>
          </div>
          <button class="pane-restore" type="button" data-restore-pane="list" hidden>＋ ${escapeHtml(labels.restoreList)}</button>
        </section>
      </div>
    </section>`;
}

function renderBlog(initialTag = "") {
  const labels = copy.collections.blog;
  const items = [...posts]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map((post) => ({ ...post, type: "blog" }));
  const cards = items.map(postCard).join("");
  return `
    <section class="page-section blog-workspace split-workspace vault-collection" data-collection="blog" data-graph-visible="true" data-list-visible="true">
      <header class="page-heading"><p class="eyebrow"><span class="eyebrow-dot"></span>${escapeHtml(labels.eyebrow)}</p><h1>${escapeHtml(labels.title)}</h1><p class="page-lead">${escapeHtml(labels.lead)}</p></header>
      <div class="workspace-toolbar">
        <label class="note-search"><span aria-hidden="true">⌕</span><input type="search" data-note-search placeholder="${escapeHtml(labels.searchPlaceholder)}" aria-label="${escapeHtml(labels.searchLabel)}" value="${escapeHtml(initialTag)}"></label>
        <div class="workspace-pane-toggles" role="group" aria-label="${escapeHtml(labels.paneGroup)}">
          <button type="button" data-toggle-pane="graph" aria-pressed="true"><span aria-hidden="true">◉</span> ${escapeHtml(labels.graphToggle)}</button>
          <button type="button" data-toggle-pane="list" aria-pressed="true"><span aria-hidden="true">☷</span> ${escapeHtml(labels.listToggle)}</button>
        </div>
      </div>
      <div class="workspace-panes">
        <section class="workspace-pane graph-pane" data-workspace-pane="graph" aria-label="${escapeHtml(labels.graphRegion)}">
          <header class="workspace-pane-heading"><div><p class="eyebrow">${escapeHtml(labels.graphEyebrow)}</p><h2>${escapeHtml(labels.graphTitle)}</h2></div><button class="pane-minimize" type="button" data-collapse-pane="graph" aria-label="${escapeHtml(labels.minimizeGraph)}" title="${escapeHtml(labels.minimizeGraph)}">−</button></header>
          <div class="pane-graph-wrap" data-graph-panel>${renderGraph(items, labels.graphTitle)}<p class="graph-help">${escapeHtml(labels.graphHelp)}</p><p class="graph-no-results" data-graph-no-results hidden>${escapeHtml(labels.graphNoResults)}</p></div>
          <button class="pane-restore" type="button" data-restore-pane="graph" hidden>＋ ${escapeHtml(labels.restoreGraph)}</button>
        </section>
        <section class="workspace-pane workspace-list-pane" data-workspace-pane="list" aria-label="${escapeHtml(labels.listRegion)}">
          <header class="workspace-pane-heading"><div><p class="eyebrow">${escapeHtml(labels.listEyebrow)}</p><h2>${escapeHtml(labels.listTitle)} <span data-workspace-count>${items.length}</span></h2></div><button class="pane-minimize" type="button" data-collapse-pane="list" aria-label="${escapeHtml(labels.minimizeList)}" title="${escapeHtml(labels.minimizeList)}">−</button></header>
          <div class="workspace-list-content blog-list-content" data-list-panel><div class="blog-card-list">${cards}</div><p class="no-results" data-no-results hidden>${escapeHtml(labels.noResults)}</p></div>
          <button class="pane-restore" type="button" data-restore-pane="list" hidden>＋ ${escapeHtml(labels.restoreList)}</button>
        </section>
      </div>
    </section>`;
}

function renderKnowledgeGraph(initialTag = "") {
  const labels = copy.collections.graph;
  return collectionExplorer(labels.title, labels.lead, allGraphItems(), "graph", initialTag);
}

function initializeSplitWorkspace(collection, initialTag = "") {
  const search = collection.querySelector("[data-note-search]");
  const graphPane = collection.querySelector('[data-workspace-pane="graph"]');
  const listPane = collection.querySelector('[data-workspace-pane="list"]');
  const noResults = collection.querySelector("[data-no-results]");
  const graphNoResults = collection.querySelector("[data-graph-no-results]");
  const resultCount = collection.querySelector("[data-workspace-count]");
  const toggleButtons = collection.querySelectorAll("[data-toggle-pane]");
  if (initialTag) search.value = initialTag;

  const setPane = (paneName, visible) => {
    const pane = paneName === "graph" ? graphPane : listPane;
    pane.hidden = !visible;
    collection.dataset[`${paneName}Visible`] = String(visible);
    toggleButtons.forEach((button) => {
      if (button.dataset.togglePane === paneName) {
        button.setAttribute("aria-pressed", String(visible));
        button.classList.toggle("is-active", visible);
      }
    });
  };

  const togglePane = (paneName) => {
    const isGraph = paneName === "graph";
    const pane = isGraph ? graphPane : listPane;
    const visible = pane.hidden;
    if (!visible && (isGraph ? listPane.hidden : graphPane.hidden)) return;
    setPane(paneName, visible);
  };

  const applyFilter = () => {
    const term = search.value.trim().toLocaleLowerCase();
    let visibleCount = 0;
    collection.querySelectorAll("[data-note-card]").forEach((card) => {
      const visible = !term || card.dataset.search.includes(term);
      card.hidden = !visible;
      if (visible) visibleCount += 1;
    });

    const graphItems = [...collection.querySelectorAll("[data-graph-item]")];
    const visibleGraphNodes = new Map();
    graphItems.forEach((node) => {
      const visible = !term || node.dataset.search.includes(term);
      node.classList.toggle("is-filtered", !visible);
      visibleGraphNodes.set(node.dataset.graphItem, visible || visibleGraphNodes.get(node.dataset.graphItem) || false);
    });
    collection.querySelectorAll("[data-edge-note]").forEach((edge) => {
      edge.classList.toggle("is-filtered", !visibleGraphNodes.get(edge.dataset.edgeNote));
    });
    collection.querySelectorAll("[data-tag-node]").forEach((tagNode) => {
      const tag = tagNode.dataset.tagNode.toLocaleLowerCase();
      const connected = graphItems.some((node) =>
        visibleGraphNodes.get(node.dataset.graphItem) &&
        JSON.parse(node.dataset.tags).includes(tag),
      );
      tagNode.classList.toggle("is-filtered", !connected);
      tagNode.classList.toggle("is-selected", term === tag);
    });
    noResults.hidden = visibleCount > 0;
    graphNoResults.hidden = visibleCount > 0;
    resultCount.textContent = String(visibleCount);
  };

  toggleButtons.forEach((button) => button.addEventListener("click", () => togglePane(button.dataset.togglePane)));
  collection.querySelectorAll("[data-collapse-pane]").forEach((button) => {
    button.addEventListener("click", () => togglePane(button.dataset.collapsePane));
  });
  search.addEventListener("input", applyFilter);
  collection.addEventListener("click", (event) => {
    const tagButton = event.target.closest("[data-select-tag]");
    const graphTag = event.target.closest("[data-tag-node]");
    const tag = tagButton?.dataset.selectTag || graphTag?.dataset.tagNode;
    if (!tag) return;
    search.value = tag;
    applyFilter();
  });
  collection.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-tag-node]")) {
      event.preventDefault();
      search.value = event.target.dataset.tagNode;
      applyFilter();
    }
  });

  setPane("graph", true);
  setPane("list", true);
  applyFilter();
}

function initializeCollectionExplorer(initialTag = "") {
  const collection = app.querySelector(".vault-collection");
  if (!collection) return;
  if (collection.dataset.collection === "projects" || collection.dataset.collection === "blog") {
    initializeSplitWorkspace(collection, initialTag);
    return;
  }
  const search = collection.querySelector("[data-note-search]");
  const graphPanel = collection.querySelector("[data-graph-panel]");
  const listPanel = collection.querySelector("[data-list-panel]");
  const resultCount = collection.querySelector("[data-result-count]");
  const noResults = collection.querySelector("[data-no-results]");
  const graphNoResults = collection.querySelector("[data-graph-no-results]");
  const countLabels = copy.collections.graph.resultCount;
  const modeButtons = collection.querySelectorAll("[data-view-mode]");
  if (initialTag) search.value = initialTag;

  const applyFilter = () => {
    const term = search.value.trim().toLocaleLowerCase();
    let visibleCount = 0;
    collection.querySelectorAll("[data-note-card]").forEach((card) => {
      const visible = !term || card.dataset.search.includes(term);
      card.hidden = !visible;
      if (visible) visibleCount += 1;
    });
    const graphItems = [...collection.querySelectorAll("[data-graph-item]")];
    const visibleGraphNodes = new Map();
    graphItems.forEach((node) => {
      const visible = !term || node.dataset.search.includes(term);
      node.classList.toggle("is-filtered", !visible);
      visibleGraphNodes.set(node.dataset.graphItem, visible || visibleGraphNodes.get(node.dataset.graphItem) || false);
    });
    collection.querySelectorAll("[data-edge-note]").forEach((edge) => {
      edge.classList.toggle("is-filtered", !visibleGraphNodes.get(edge.dataset.edgeNote));
    });
    collection.querySelectorAll("[data-tag-node]").forEach((tagNode) => {
      const tag = tagNode.dataset.tagNode.toLocaleLowerCase();
      const connected = graphItems.some((node) =>
        visibleGraphNodes.get(node.dataset.graphItem) &&
        JSON.parse(node.dataset.tags).includes(tag),
      );
      tagNode.classList.toggle("is-filtered", !connected);
      tagNode.classList.toggle("is-selected", term === tag);
    });
    resultCount.textContent = copyText(countLabels[visibleCount === 1 ? "singular" : "plural"], { count: visibleCount });
    noResults.hidden = visibleCount > 0;
    graphNoResults.hidden = visibleCount > 0;
  };

  const setView = (mode) => {
    const graphVisible = mode === "graph";
    graphPanel.hidden = !graphVisible;
    listPanel.hidden = graphVisible;
    modeButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.viewMode === mode));
    });
  };

  modeButtons.forEach((button) => button.addEventListener("click", () => setView(button.dataset.viewMode)));
  search.addEventListener("input", applyFilter);
  collection.addEventListener("click", (event) => {
    const tagButton = event.target.closest("[data-select-tag]");
    const graphTag = event.target.closest("[data-tag-node]");
    const tag = tagButton?.dataset.selectTag || graphTag?.dataset.tagNode;
    if (!tag) return;
    search.value = tag;
    applyFilter();
  });
  collection.addEventListener("keydown", (event) => {
    if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-tag-node]")) {
      event.preventDefault();
      search.value = event.target.dataset.tagNode;
      applyFilter();
    }
  });
  applyFilter();
  setView("graph");
}

function renderAbout() {
  const labels = copy.about;
  const imageUrl = safeUrl(site.aboutImage);
  const socials = (site.socials || [])
    .map((social) => `<a class="social-link" ${linkAttributes(social.url)}>${escapeHtml(social.label)} <span aria-hidden="true">↗</span></a>`)
    .join("");
  const title = `${escapeHtml(labels.titlePrefix)}<span class="serif-accent">${escapeHtml(site.name)}</span>${escapeHtml(labels.titleSuffix)}`;
  return shell(labels.eyebrow, title, "", `
    <div class="about-layout"><div class="about-copy">${(site.about || []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}<div class="social-links">${socials}</div></div>
    <aside class="about-aside"><div class="aside-mark" aria-hidden="true">✳</div>${imageUrl ? `<figure class="about-portrait"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(site.aboutImageAlt || "")}"></figure>` : ""}<p class="eyebrow">${escapeHtml(labels.valuesHeading)}</p><ul>${(site.values || []).map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul></aside></div>`);
}

function renderResume() {
  const labels = copy.resume;
  const experience = (resume.experience || []).map((item) => `
    <article class="resume-entry"><div class="resume-entry-main"><h3>${escapeHtml(item.role)}</h3><p>${escapeHtml(item.organization)}</p><span>${escapeHtml(item.description)}</span></div><time>${escapeHtml(item.period)}</time></article>`).join("");
  const education = (resume.education || []).map((item) => `
    <article class="resume-entry"><div class="resume-entry-main"><h3>${escapeHtml(item.qualification)}</h3><p>${escapeHtml(item.organization)}</p></div><time>${escapeHtml(item.period)}</time></article>`).join("");
  const resumeUrl = safeUrl(resume.file);
  const driveFileId = resumeUrl.match(/^https:\/\/drive\.google\.com\/file\/d\/([^/?#]+)/i)?.[1];
  const resumeHref = driveFileId
    ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveFileId)}`
    : resumeUrl;
  const download = resumeHref
    ? `<a class="button button-outline" href="${escapeHtml(resumeHref)}"${/^https?:/i.test(resumeHref) ? ' target="_blank" rel="noreferrer"' : " download"}>${escapeHtml(labels.downloadLabel)} <span aria-hidden="true">↓</span></a>`
    : "";
  return shell(labels.eyebrow, labels.title, labels.lead, `
    <div class="resume-summary"><p>${escapeHtml(resume.summary || "")}</p>${download}</div>
    <div class="resume-columns"><section class="resume-block"><h2>${escapeHtml(labels.experienceHeading)}</h2>${experience}</section><section class="resume-block"><h2>${escapeHtml(labels.educationHeading)}</h2>${education}<h2 class="skills-heading">${escapeHtml(labels.skillsHeading)}</h2><div class="skill-list">${(resume.skills || []).map((skill) => `<span>${escapeHtml(skill)}</span>`).join("")}</div></section></div>`);
}

function renderContact() {
  const labels = copy.contact;
  const email = safeUrl(`mailto:${site.email || ""}`);
  const socials = (site.socials || [])
    .map((social) => `<a class="social-link" ${linkAttributes(social.url)}>${escapeHtml(social.label)} <span aria-hidden="true">↗</span></a>`)
    .join("");
  const title = `${escapeHtml(labels.titlePrefix)}<span class="serif-accent">${escapeHtml(labels.titleEmphasis)}</span>`;
  return shell(labels.eyebrow, title, labels.lead, `
    <div class="contact-panel"><span class="contact-icon" aria-hidden="true">↗</span><p class="eyebrow">${escapeHtml(labels.panelEyebrow)}</p><a class="contact-email" href="${escapeHtml(email)}">${escapeHtml(site.email)}</a><div class="social-links">${socials}</div></div>`);
}

async function renderDetail(type, slug) {
  const collection = type === "projects" ? projects : posts;
  const item = collection.find((entry) => entry.slug === slug);
  if (!item) return shell(copy.detail.notFoundEyebrow, copy.detail.notFoundTitle, copy.detail.notFoundLead, `<a class="text-link" href="#/${type}">${escapeHtml(copyText(copy.detail.backTo, { section: copy.navigation[type] }))} <span aria-hidden="true">→</span></a>`);
  const response = await fetch(new URL(item.content, baseUrl));
  if (!response.ok) throw new Error(`${response.status}: ${item.content}`);
  const markdown = await response.text();
  const isProject = type === "projects";
  const metadata = isProject ? item.category : `${item.category} · ${formatDate(item.date)} · ${escapeHtml(item.readTime || "")}`;
  const actions = isProject
    ? [item.liveUrl && `<a class="button button-dark" ${linkAttributes(item.liveUrl)}>${escapeHtml(copy.detail.visitProject)} <span aria-hidden="true">↗</span></a>`, item.repoUrl && `<a class="button button-outline" ${linkAttributes(item.repoUrl)}>${escapeHtml(copy.detail.viewSource)} <span aria-hidden="true">↗</span></a>`].filter(Boolean).join("")
    : "";
  const backLabel = copyText(copy.detail.backTo, { section: copy.navigation[type] });
  return `
    <article class="article-page">
      <a class="back-link" href="#/${type}">← ${escapeHtml(backLabel)}</a>
      <header class="article-heading"><p class="eyebrow">${metadata}</p><h1>${escapeHtml(item.title)}</h1><p class="page-lead">${escapeHtml(isProject ? item.subtitle : item.excerpt)}</p>${renderDetailTags(item.tags)}${actions ? `<div class="article-actions">${actions}</div>` : ""}</header>
      <div class="markdown-content">${renderMarkdown(markdown)}</div>
      ${renderRelatedNotes(item, type)}
    </article>`;
}

function renderDetailTags(tags = []) {
  if (!tags.length) return "";
  return `<div class="detail-tags" aria-label="${escapeHtml(copy.detail.tagsLabel)}">${tags.map((tag) => `<a class="tag-chip" href="#/graph?tag=${encodeURIComponent(tag)}">#${escapeHtml(tag)}</a>`).join("")}</div>`;
}

function renderRelatedNotes(item, type) {
  const related = [...posts.map((post) => ({ ...post, type: "blog" })), ...projects.map((project) => ({ ...project, type: "project" }))]
    .filter((entry) => !(entry.type === (type === "projects" ? "project" : "blog") && entry.slug === item.slug))
    .map((entry) => ({ entry, overlap: contentTags(entry).filter((tag) => contentTags(item).some((itemTag) => itemTag.toLocaleLowerCase() === tag.toLocaleLowerCase())) }))
    .filter(({ overlap }) => overlap.length)
    .slice(0, 4);
  if (!related.length) return "";
  return `<aside class="related-notes"><p class="eyebrow">${escapeHtml(copy.detail.backlinksEyebrow)}</p><div>${related.map(({ entry, overlap }) => `<a class="related-note" href="${contentHref(entry)}"><span>${escapeHtml(entry.type === "project" ? copy.detail.projectKind : copy.detail.noteKind)} / ${escapeHtml(overlap.map((tag) => `#${tag}`).join(" "))}</span><strong>${escapeHtml(entry.title)}</strong></a>`).join("")}</div></aside>`;
}

function updateNavigation(route) {
  const activeRoute = route.split("/")[1] || "";
  document.querySelectorAll(".navigation [data-route]").forEach((link) => {
    const isActive = link.dataset.route === activeRoute;
    link.classList.toggle("is-active", isActive);
    if (isActive) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

async function renderRoute() {
  const renderId = ++activeRender;
  const [hashPath, queryString = ""] = location.hash.replace(/^#\/?/, "").split("?", 2);
  const route = decodeURIComponent(hashPath || "home");
  const initialTag = new URLSearchParams(queryString).get("tag") || "";
  const [section, slug] = route.split("/");
  updateNavigation(route);
  navigation.classList.remove("is-open");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", copy.navigation.openMenu);
  app.innerHTML = `<div class="loading-state">${escapeHtml(copy.states.loading)}<span>.</span></div>`;

  try {
    let page;
    switch (section) {
      case "resume": page = renderResume(); break;
      case "graph": page = renderKnowledgeGraph(initialTag); break;
      case "projects": page = slug ? await renderDetail("projects", slug) : renderProjects(initialTag); break;
      case "blog": page = slug ? await renderDetail("blog", slug) : renderBlog(initialTag); break;
      case "about": page = renderAbout(); break;
      case "contact": page = renderContact(); break;
      default: page = renderHome();
    }
    if (renderId !== activeRender) return;
    app.innerHTML = page;
    initializeGraphInteractions(app);
    initializeCollectionExplorer(initialTag);
    document.title = `${section === "home" ? site.name : copy.navigation[section] || copy.navigation.home} — ${site.name}`;
    document.querySelector("#main-content").focus({ preventScroll: true });
  } catch (error) {
    console.error(error);
    if (renderId !== activeRender) return;
    app.innerHTML = `<section class="page-section error-state"><p class="eyebrow">${escapeHtml(copy.states.pageErrorEyebrow)}</p><h1>${escapeHtml(copy.states.pageErrorTitle)}</h1><p class="page-lead">${escapeHtml(copy.states.pageErrorLead)}</p></section>`;
  }
}

async function start() {
  try {
    copy = await loadJson(paths.content);
    [site, resume, projects, posts] = await Promise.all([
      loadJson(paths.site),
      loadJson(paths.resume),
      loadJson(paths.projects),
      loadJson(paths.posts),
    ]);
    initializeShell();
    initializeTheme();
    if (!location.hash) history.replaceState(null, "", "#/home");
    await renderRoute();
  } catch (error) {
    console.error(error);
    console.error(error);
    if (copy) {
      app.innerHTML = `<section class="page-section error-state"><p class="eyebrow">${escapeHtml(copy.states.setupErrorEyebrow)}</p><h1>${escapeHtml(copy.states.setupErrorTitle)}</h1><p class="page-lead">${escapeHtml(copy.states.setupErrorLead)}</p></section>`;
    } else {
      app.textContent = error.message;
    }
  }
}

menuToggle.addEventListener("click", () => {
  const open = menuToggle.getAttribute("aria-expanded") !== "true";
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? copy.navigation.closeMenu : copy.navigation.openMenu);
  navigation.classList.toggle("is-open", open);
});

app.addEventListener("click", (event) => {
  const tagButton = event.target.closest("[data-select-tag]");
  if (!tagButton || tagButton.closest(".vault-collection")) return;
  location.hash = `#/graph?tag=${encodeURIComponent(tagButton.dataset.selectTag)}`;
});

themeToggle.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  setTheme(nextTheme, true);
});

window.addEventListener("hashchange", renderRoute);
start();
