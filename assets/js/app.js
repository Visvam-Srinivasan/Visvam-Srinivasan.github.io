const app = document.querySelector("#app");
const navigation = document.querySelector(".navigation");
const menuToggle = document.querySelector(".menu-toggle");
const themeToggle = document.querySelector(".theme-toggle");
const currentYear = document.querySelector("#current-year");
const baseUrl = new URL("../../", import.meta.url);
const paths = {
  site: "data/site.json",
  projects: "data/projects.json",
  posts: "data/posts.json",
};

let site;
let projects;
let posts;
let activeRender = 0;

currentYear.textContent = new Date().getFullYear();

function setTheme(theme, persist = false) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  themeToggle.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} mode`);
  themeToggle.title = `Switch to ${isDark ? "light" : "dark"} mode`;
  themeToggle.querySelector('[aria-hidden="true"]').textContent = isDark ? "☀" : "☾";
  themeToggle.querySelector(".theme-toggle-label").textContent = isDark ? "DARK MODE" : "LIGHT MODE";
  document.querySelector('meta[name="theme-color"]').content = isDark ? "#171b24" : "#f5f1e7";
  if (persist) {
    try {
      localStorage.setItem("portfolio-theme", isDark ? "dark" : "light");
    } catch (error) {
      console.error("Could not save the selected color theme.", error);
    }
  }
}

function initializeTheme() {
  let savedTheme;
  try {
    savedTheme = localStorage.getItem("portfolio-theme");
  } catch (error) {
    console.error("Could not read the saved color theme.", error);
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
  if (/^(https?:|mailto:|tel:|\/|\.\/|\.\.\/|#)/i.test(url)) return url;
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
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status}).`);
  return response.json();
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

function renderGraph(items, label = "Knowledge graph", linkTags = false) {
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
  if (!items.length) return `<div class="graph-empty">No notes to connect yet.</div>`;

  const columns = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(tags.length))));
  const clusterWidth = 340;
  const clusterHeight = 270;
  const width = Math.max(650, columns * clusterWidth);
  const rows = Math.ceil(tags.length / columns);
  const height = Math.max(300, rows * clusterHeight);
  const edges = [];
  const tagNodes = [];
  const contentNodes = [];
  const tagPositions = new Map();

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
    const tagNode = `<g class="graph-tag-node${featuredTag ? " is-featured" : ""}" data-tag-node="${escapeHtml(tag)}" role="button" tabindex="0" aria-label="Filter by tag ${escapeHtml(tag)}" transform="translate(${center.x} ${center.y})"><circle r="29"/><text class="graph-hash" y="5">#</text><text class="graph-tag-label" y="47">${escapeHtml(tag)}</text></g>`;
    tagNodes.push(linkTags ? `<a class="graph-tag-link" href="#/graph?tag=${encodeURIComponent(tag)}" aria-label="Explore the ${escapeHtml(tag)} tag">${tagNode}</a>` : tagNode);
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
    return { item, id, point };
  });
  const coincidentPoints = new Map();
  positionedItems.forEach(({ point }) => {
    const key = `${Math.round(point.x)}:${Math.round(point.y)}`;
    coincidentPoints.set(key, (coincidentPoints.get(key) || 0) + 1);
  });
  const pointOffsets = new Map();
  positionedItems.forEach(({ item, id, point }) => {
    const pointKey = `${Math.round(point.x)}:${Math.round(point.y)}`;
    const groupSize = coincidentPoints.get(pointKey);
    const index = pointOffsets.get(pointKey) || 0;
    pointOffsets.set(pointKey, index + 1);
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / groupSize;
    const radius = groupSize > 1 ? 44 : 66;
    const nodePoint = {
      x: point.x + Math.cos(angle) * radius,
      y: point.y + Math.sin(angle) * radius,
    };
    const featured = item.type === "project" && contentTags(item).some((tag) => tag.toLocaleLowerCase() === "featured");
    const title = item.title.length > 24 ? `${item.title.slice(0, 23).trimEnd()}…` : item.title;

    contentTags(item).forEach((tag) => {
      const tagPoint = tagPositions.get(tag.toLocaleLowerCase());
      if (tagPoint) {
        edges.push(`<line class="graph-edge${featured ? " is-featured" : ""}" data-edge-note="${escapeHtml(id)}" x1="${tagPoint.x}" y1="${tagPoint.y}" x2="${nodePoint.x}" y2="${nodePoint.y}"/>`);
      }
    });
    contentNodes.push(`<a class="graph-item-node graph-item-${item.type}${featured ? " is-featured" : ""}" transform="translate(${nodePoint.x} ${nodePoint.y})" data-graph-item="${escapeHtml(id)}" data-search="${escapeHtml(`${item.title} ${item.description || item.excerpt || ""} ${contentTags(item).join(" ")}`.toLocaleLowerCase())}" data-tags="${escapeHtml(JSON.stringify(contentTags(item).map((tag) => tag.toLocaleLowerCase())))}" href="${contentHref(item)}" aria-label="Open ${escapeHtml(item.title)}"><circle r="${featured ? 9 : 7}"/><text x="0" y="22" text-anchor="middle">${escapeHtml(title)}</text><title>${escapeHtml(item.title)} · ${contentTags(item).map(escapeHtml).join(", ")}</title></a>`);
  });

  return `<svg class="graph-svg" viewBox="0 0 ${width} ${height}" role="group" aria-label="${escapeHtml(label)} connecting notes around central tags"><g aria-hidden="true">${edges.join("")}</g>${tagNodes.join("")}${contentNodes.join("")}</svg>`;
}

function allGraphItems() {
  return [
    ...posts.map((post) => ({ ...post, type: "blog" })),
    ...projects.map((project) => ({ ...project, type: "project" })),
  ];
}

function collectionExplorer(title, lead, items, collection, initialTag = "") {
  const plural = collection === "graph" ? "vault items" : collection;
  const countLabel = collection === "graph" ? "items" : "notes";
  const cards = items.map((item) => item.type === "project" ? projectCard(item) : postCard(item)).join("");
  return `
    <section class="page-section collection-page vault-collection" data-collection="${escapeHtml(collection)}">
      <header class="page-heading"><p class="eyebrow"><span class="eyebrow-dot"></span>THE VAULT / ${escapeHtml(plural.toUpperCase())}</p><h1>${escapeHtml(title)}</h1><p class="page-lead">${escapeHtml(lead)}</p></header>
      <div class="collection-toolbar">
        <label class="note-search"><span aria-hidden="true">⌕</span><input type="search" data-note-search placeholder="Search notes and tags…" aria-label="Search notes and tags" value="${escapeHtml(initialTag)}"></label>
        <div class="view-switch" role="group" aria-label="Choose collection view"><button type="button" data-view-mode="graph" aria-pressed="true"><span aria-hidden="true">⌘</span> Graph</button><button type="button" data-view-mode="list" aria-pressed="false"><span aria-hidden="true">☷</span> List</button></div>
      </div>
      <div class="collection-meta"><span data-result-count>${items.length} ${items.length === 1 ? countLabel.slice(0, -1) : countLabel}</span><span><i class="legend-note"></i> note <i class="legend-tag"></i> shared tag</span></div>
      <div class="graph-panel" data-graph-panel>${renderGraph(items, title)}<p class="graph-help">Select a note to open it. Select a <span>#tag</span> node to filter connected notes.</p><p class="graph-no-results" data-graph-no-results hidden>No connected notes match that search.</p></div>
      <div class="note-list-panel" data-list-panel hidden><div class="note-list-grid">${cards}</div><p class="no-results" data-no-results hidden>No ${countLabel} match that search. Try another word or tag.</p></div>
    </section>`;
}

function formatDate(value) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? escapeHtml(value || "")
    : new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(date);
}

function shell(eyebrow, title, lead, content) {
  return `
    <section class="page-section">
      <div class="page-heading"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${lead ? `<p class="page-lead">${lead}</p>` : ""}</div>
      ${content}
    </section>`;
}

function renderHome() {
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
        <h1>Thoughtful work.<br><span>Made for people.</span></h1>
        <p class="hero-intro">${escapeHtml(site.intro)}</p>
        <div class="hero-actions"><a class="button button-dark" href="#/projects">Explore my work <span aria-hidden="true">↗</span></a><a class="text-link" href="#/about">A little about me <span aria-hidden="true">→</span></a></div>
      </div>
      <div class="hero-art" aria-label="Abstract illustration">
        <div class="art-sun"></div><div class="art-orbit orbit-one"></div><div class="art-orbit orbit-two"></div>
        <div class="art-card"><span class="art-card-label">CURRENTLY</span><strong>${escapeHtml(site.role)}</strong><span>${escapeHtml(site.location)}</span></div>
        <span class="art-spark spark-one">✳</span><span class="art-spark spark-two">✳</span>
        <span class="art-caption">${escapeHtml(site.artCaption || "")}</span>
      </div>
    </section>
    <section class="home-map">
      <div class="section-heading"><div><p class="eyebrow">MY NOTES IN CONTEXT</p><h2>Explore the vault</h2><p class="page-lead">Follow the shared ideas between notes and projects.</p></div><a class="text-link" href="#/graph">Open full graph <span aria-hidden="true">↗</span></a></div>
      <div class="graph-panel home-graph">${renderGraph(graphItems, "Portfolio knowledge graph", true)}<p class="graph-help">Choose a note to open it, or a <span>#tag</span> to explore its connections.</p></div>
    </section>
    <section class="content-section">
      <div class="section-heading"><div><p class="eyebrow">A few things I’ve made</p><h2>Selected work</h2></div><a class="text-link" href="#/projects">All projects <span aria-hidden="true">→</span></a></div>
      <div class="project-grid">${featuredProjects.map(projectCard).join("")}</div>
    </section>
    <section class="home-note">
      <span class="note-mark" aria-hidden="true">✳</span><p>${escapeHtml(site.belief || "")}</p><a class="text-link" href="#/about">More about me <span aria-hidden="true">→</span></a>
    </section>
    <section class="content-section journal-section">
      <div class="section-heading"><div><p class="eyebrow">Notes from the process</p><h2>Recent writing</h2></div><a class="text-link" href="#/blog">All writing <span aria-hidden="true">→</span></a></div>
      <div class="post-grid">${featuredPosts.map(postCard).join("")}</div>
    </section>`;
}

function renderProjects(initialTag = "") {
  const items = projects.map((project) => ({ ...project, type: "project" }));
  const featured = items.filter((project) => contentTags(project).some((tag) => tag.toLocaleLowerCase() === "featured"));
  const other = items.filter((project) => !featured.includes(project));
  const projectList = (entries) => entries.map(projectCard).join("");
  return `
    <section class="page-section projects-workspace vault-collection" data-collection="projects" data-graph-visible="true" data-list-visible="true">
      <header class="page-heading"><p class="eyebrow"><span class="eyebrow-dot"></span>THE VAULT / PROJECTS</p><h1>Projects</h1><p class="page-lead">A collection of things I’ve helped bring into the world. Follow shared tags or browse the project notes.</p></header>
      <div class="workspace-toolbar">
        <label class="note-search"><span aria-hidden="true">⌕</span><input type="search" data-note-search placeholder="Search projects and tags…" aria-label="Search projects and tags" value="${escapeHtml(initialTag)}"></label>
        <div class="workspace-pane-toggles" role="group" aria-label="Show or hide project panes">
          <button type="button" data-toggle-pane="graph" aria-pressed="true"><span aria-hidden="true">◉</span> Graph</button>
          <button type="button" data-toggle-pane="list" aria-pressed="true"><span aria-hidden="true">☷</span> Projects</button>
        </div>
      </div>
      <div class="project-panes">
        <section class="project-pane graph-pane" data-project-pane="graph" aria-label="Project graph">
          <header class="project-pane-heading"><div><p class="eyebrow">01 / CONNECTIONS</p><h2>Project graph</h2></div><button class="pane-minimize" type="button" data-collapse-pane="graph" aria-label="Minimize project graph" title="Minimize graph">−</button></header>
          <div class="pane-graph-wrap" data-graph-panel>${renderGraph(items, "Project graph")}<p class="graph-help">Featured projects glow amber. Select a project or tag to explore.</p><p class="graph-no-results" data-graph-no-results hidden>No connected projects match that search.</p></div>
          <button class="pane-restore" type="button" data-restore-pane="graph" hidden>＋ Show graph</button>
        </section>
        <section class="project-pane project-list-pane" data-project-pane="list" aria-label="Project list">
          <header class="project-pane-heading"><div><p class="eyebrow">02 / PROJECT NOTES</p><h2>All projects <span data-project-count>${projects.length}</span></h2></div><button class="pane-minimize" type="button" data-collapse-pane="list" aria-label="Minimize project list" title="Minimize list">−</button></header>
          <div class="project-list-content" data-list-panel>
            ${featured.length ? `<section class="featured-projects"><div class="list-section-heading"><h3>Featured</h3><span>PINNED / ${String(featured.length).padStart(2, "0")}</span></div><div class="project-card-list">${projectList(featured)}</div></section>` : ""}
            <section class="other-projects"><div class="list-section-heading"><h3>More projects</h3><span>${String(other.length).padStart(2, "0")} NOTES</span></div><div class="project-card-list">${projectList(other)}</div></section>
            <p class="no-results" data-no-results hidden>No projects match that search. Try another word or tag.</p>
          </div>
          <button class="pane-restore" type="button" data-restore-pane="list" hidden>＋ Show project list</button>
        </section>
      </div>
    </section>`;
}

function renderBlog(initialTag = "") {
  const items = [...posts]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map((post) => ({ ...post, type: "blog" }));
  return collectionExplorer("The journal", "Notes on design, making things, and everything in between.", items, "blog", initialTag);
}

function renderKnowledgeGraph(initialTag = "") {
  return collectionExplorer("Knowledge graph", "A map of notes and projects, connected by the ideas they share.", allGraphItems(), "graph", initialTag);
}

function initializeProjectsWorkspace(collection, initialTag = "") {
  const search = collection.querySelector("[data-note-search]");
  const graphPane = collection.querySelector('[data-project-pane="graph"]');
  const listPane = collection.querySelector('[data-project-pane="list"]');
  const graphPanel = collection.querySelector("[data-graph-panel]");
  const listPanel = collection.querySelector("[data-list-panel]");
  const noResults = collection.querySelector("[data-no-results]");
  const graphNoResults = collection.querySelector("[data-graph-no-results]");
  const projectCount = collection.querySelector("[data-project-count]");
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
    projectCount.textContent = String(visibleCount);
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
  if (collection.dataset.collection === "projects") {
    initializeProjectsWorkspace(collection, initialTag);
    return;
  }
  const search = collection.querySelector("[data-note-search]");
  const graphPanel = collection.querySelector("[data-graph-panel]");
  const listPanel = collection.querySelector("[data-list-panel]");
  const resultCount = collection.querySelector("[data-result-count]");
  const noResults = collection.querySelector("[data-no-results]");
  const graphNoResults = collection.querySelector("[data-graph-no-results]");
  const countLabel = collection.dataset.collection === "graph" ? "item" : "note";
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
    resultCount.textContent = `${visibleCount} ${visibleCount === 1 ? countLabel : `${countLabel}s`}`;
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
  const socials = (site.socials || [])
    .map((social) => `<a class="social-link" ${linkAttributes(social.url)}>${escapeHtml(social.label)} <span aria-hidden="true">↗</span></a>`)
    .join("");
  return shell("A little introduction", `Hello, I’m <span class="serif-accent">${escapeHtml(site.name)}</span>.`, "", `
    <div class="about-layout"><div class="about-copy">${(site.about || []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}<div class="social-links">${socials}</div></div>
    <aside class="about-aside"><div class="aside-mark" aria-hidden="true">✳</div><p class="eyebrow">A few things I value</p><ul>${(site.values || []).map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul></aside></div>`);
}

function renderResume() {
  const resume = site.resume || {};
  const experience = (resume.experience || []).map((item) => `
    <article class="resume-entry"><div class="resume-entry-main"><h3>${escapeHtml(item.role)}</h3><p>${escapeHtml(item.organization)}</p><span>${escapeHtml(item.description)}</span></div><time>${escapeHtml(item.period)}</time></article>`).join("");
  const education = (resume.education || []).map((item) => `
    <article class="resume-entry"><div class="resume-entry-main"><h3>${escapeHtml(item.qualification)}</h3><p>${escapeHtml(item.organization)}</p></div><time>${escapeHtml(item.period)}</time></article>`).join("");
  const download = site.resumeFile
    ? `<a class="button button-outline" href="${escapeHtml(safeUrl(site.resumeFile))}" download>Download resume <span aria-hidden="true">↓</span></a>`
    : "";
  return shell("Experience & skills", "The resume", "A snapshot of what I’ve done and what I bring.", `
    <div class="resume-summary"><p>${escapeHtml(resume.summary || "")}</p>${download}</div>
    <div class="resume-columns"><section class="resume-block"><h2>Experience</h2>${experience}</section><section class="resume-block"><h2>Education</h2>${education}<h2 class="skills-heading">A few skills</h2><div class="skill-list">${(resume.skills || []).map((skill) => `<span>${escapeHtml(skill)}</span>`).join("")}</div></section></div>`);
}

function renderContact() {
  const email = safeUrl(`mailto:${site.email || ""}`);
  const socials = (site.socials || [])
    .map((social) => `<a class="social-link" ${linkAttributes(social.url)}>${escapeHtml(social.label)} <span aria-hidden="true">↗</span></a>`)
    .join("");
  return shell("Have a good one in mind?", "Let’s make it <span class=\"serif-accent\">happen.</span>", "Tell me a little about what you’re working on. I’d love to hear about it.", `
    <div class="contact-panel"><span class="contact-icon" aria-hidden="true">↗</span><p class="eyebrow">For projects, conversations, or a nice hello</p><a class="contact-email" href="${escapeHtml(email)}">${escapeHtml(site.email)}</a><div class="social-links">${socials}</div></div>`);
}

async function renderDetail(type, slug) {
  const collection = type === "projects" ? projects : posts;
  const item = collection.find((entry) => entry.slug === slug);
  if (!item) return shell("Not found", "Nothing here just yet.", "This page may have moved or the link may be incorrect.", `<a class="text-link" href="#/${type}">Back to ${type} <span aria-hidden="true">→</span></a>`);
  const response = await fetch(new URL(item.content, baseUrl));
  if (!response.ok) throw new Error(`Could not load ${item.content} (${response.status}).`);
  const markdown = await response.text();
  const isProject = type === "projects";
  const metadata = isProject ? item.category : `${item.category} · ${formatDate(item.date)} · ${escapeHtml(item.readTime || "")}`;
  const actions = isProject
    ? [item.liveUrl && `<a class="button button-dark" ${linkAttributes(item.liveUrl)}>Visit project <span aria-hidden="true">↗</span></a>`, item.repoUrl && `<a class="button button-outline" ${linkAttributes(item.repoUrl)}>View source <span aria-hidden="true">↗</span></a>`].filter(Boolean).join("")
    : "";
  return `
    <article class="article-page">
      <a class="back-link" href="#/${type}">← Back to ${type}</a>
      <header class="article-heading"><p class="eyebrow">${metadata}</p><h1>${escapeHtml(item.title)}</h1><p class="page-lead">${escapeHtml(isProject ? item.subtitle : item.excerpt)}</p>${renderDetailTags(item.tags)}${actions ? `<div class="article-actions">${actions}</div>` : ""}</header>
      <div class="markdown-content">${renderMarkdown(markdown)}</div>
      ${renderRelatedNotes(item, type)}
    </article>`;
}

function renderDetailTags(tags = []) {
  if (!tags.length) return "";
  return `<div class="detail-tags" aria-label="Note tags">${tags.map((tag) => `<a class="tag-chip" href="#/graph?tag=${encodeURIComponent(tag)}">#${escapeHtml(tag)}</a>`).join("")}</div>`;
}

function renderRelatedNotes(item, type) {
  const related = [...posts.map((post) => ({ ...post, type: "blog" })), ...projects.map((project) => ({ ...project, type: "project" }))]
    .filter((entry) => !(entry.type === (type === "projects" ? "project" : "blog") && entry.slug === item.slug))
    .map((entry) => ({ entry, overlap: contentTags(entry).filter((tag) => contentTags(item).some((itemTag) => itemTag.toLocaleLowerCase() === tag.toLocaleLowerCase())) }))
    .filter(({ overlap }) => overlap.length)
    .slice(0, 4);
  if (!related.length) return "";
  return `<aside class="related-notes"><p class="eyebrow">BACKLINKS / SHARED TAGS</p><div>${related.map(({ entry, overlap }) => `<a class="related-note" href="${contentHref(entry)}"><span>${escapeHtml(entry.type === "project" ? "PROJECT" : "NOTE")} / ${escapeHtml(overlap.map((tag) => `#${tag}`).join(" "))}</span><strong>${escapeHtml(entry.title)}</strong></a>`).join("")}</div></aside>`;
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
  menuToggle.setAttribute("aria-label", "Open navigation");
  app.innerHTML = '<div class="loading-state">A moment, please<span>.</span></div>';

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
    initializeCollectionExplorer(initialTag);
    document.title = `${section === "home" ? site.name : section.charAt(0).toUpperCase() + section.slice(1)} — ${site.name}`;
    document.querySelector("#main-content").focus({ preventScroll: true });
  } catch (error) {
    console.error(error);
    if (renderId !== activeRender) return;
    app.innerHTML = `<section class="page-section error-state"><p class="eyebrow">Something went wrong</p><h1>This page couldn’t load.</h1><p class="page-lead">Please check the content files and try again.</p></section>`;
  }
}

async function start() {
  try {
    [site, projects, posts] = await Promise.all([
      loadJson(paths.site),
      loadJson(paths.projects),
      loadJson(paths.posts),
    ]);
    document.querySelectorAll('[data-site="name"]').forEach((node) => {
      node.textContent = site.name;
    });
    document.querySelector(".wordmark-mark").textContent = (site.name || "Y").trim().charAt(0).toUpperCase();
    document.querySelector(".wordmark").setAttribute("aria-label", `${site.name} — home`);
    document.querySelector(".site-footer > span:nth-child(2)").textContent = `Made with care by ${site.name}.`;
    if (!location.hash) history.replaceState(null, "", "#/home");
    await renderRoute();
  } catch (error) {
    console.error(error);
    app.innerHTML = `<section class="page-section error-state"><p class="eyebrow">A setup issue</p><h1>Couldn’t load the portfolio content.</h1><p class="page-lead">Check that you’re serving this folder over HTTP and that the JSON files in <code>data/</code> are valid.</p></section>`;
  }
}

menuToggle.addEventListener("click", () => {
  const open = menuToggle.getAttribute("aria-expanded") !== "true";
  menuToggle.setAttribute("aria-expanded", String(open));
  menuToggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
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
initializeTheme();
start();
