const app = document.querySelector("#app");
const navigation = document.querySelector(".navigation");
const menuToggle = document.querySelector(".menu-toggle");
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
  return `
    <a class="project-card" href="#/projects/${encodeURIComponent(project.slug)}">
      <div class="project-cover cover-${escapeHtml(project.accent || "peach")}">${image}<span class="cover-arrow" aria-hidden="true">↗</span></div>
      <div class="card-meta"><span>${escapeHtml(project.category)}</span><span>${(project.tags || []).slice(0, 2).map(escapeHtml).join(" · ")}</span></div>
      <h3>${escapeHtml(project.title)}</h3>
      <p>${escapeHtml(project.description)}</p>
    </a>`;
}

function postCard(post) {
  return `
    <a class="post-card" href="#/blog/${encodeURIComponent(post.slug)}">
      <span class="post-date">${escapeHtml(post.category)} <span aria-hidden="true">·</span> ${formatDate(post.date)}</span>
      <h3>${escapeHtml(post.title)} <span aria-hidden="true">↗</span></h3>
      <p>${escapeHtml(post.excerpt)}</p>
      <span class="read-time">${escapeHtml(post.readTime || "")}</span>
    </a>`;
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
  const featuredProjects = (site.featuredProjects || [])
    .map((slug) => projects.find((project) => project.slug === slug))
    .filter(Boolean);
  const featuredPosts = (site.featuredPosts || [])
    .map((slug) => posts.find((post) => post.slug === slug))
    .filter(Boolean);
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

function renderProjects() {
  return shell("Selected work", "Projects", "A collection of things I’ve helped bring into the world.", `
    <div class="project-grid project-grid-page">${projects.map(projectCard).join("")}</div>`);
}

function renderBlog() {
  const sortedPosts = [...posts].sort((a, b) => new Date(b.date) - new Date(a.date));
  return shell("Ideas & observations", "The journal", "Notes on design, making things, and everything in between.", `
    <div class="post-list">${sortedPosts.map(postCard).join("")}</div>`);
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
      <header class="article-heading"><p class="eyebrow">${metadata}</p><h1>${escapeHtml(item.title)}</h1><p class="page-lead">${escapeHtml(isProject ? item.subtitle : item.excerpt)}</p>${actions ? `<div class="article-actions">${actions}</div>` : ""}</header>
      <div class="markdown-content">${renderMarkdown(markdown)}</div>
    </article>`;
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
  const route = decodeURIComponent(location.hash.replace(/^#\/?/, "") || "home");
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
      case "projects": page = slug ? await renderDetail("projects", slug) : renderProjects(); break;
      case "blog": page = slug ? await renderDetail("blog", slug) : renderBlog(); break;
      case "about": page = renderAbout(); break;
      case "contact": page = renderContact(); break;
      default: page = renderHome();
    }
    if (renderId !== activeRender) return;
    app.innerHTML = page;
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

window.addEventListener("hashchange", renderRoute);
start();
