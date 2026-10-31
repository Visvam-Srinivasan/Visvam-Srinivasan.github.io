# Portfolio starter

A responsive, Obsidian-inspired portfolio with a linked knowledge graph, graph/list views, light and dark themes, and content kept in JSON and Markdown. Notes and projects connect through shared tags. It uses plain HTML, CSS, and JavaScript, has no build step or runtime dependencies, and can be hosted directly on GitHub Pages. The theme toggle follows the visitor's system preference initially and remembers their choice in the browser.

## Make it yours

1. Edit `data/site.json` with your name, role, location, email, bio, and social links. Edit `data/content.json` for page headings, interface copy, labels, and navigation text.
2. Edit `data/projects.json` and `data/posts.json` to add or reorder project and blog cards. Give each entry a `tags` array (for example, `"tags": ["Interface design", "Accessibility"]`). Tags with the same spelling connect notes and projects automatically; add `Featured` to a project's tags to include it in the featured project sections.
3. Write each project or post in its own Markdown file under `content/projects/` or `content/posts/`.
4. Put images in `assets/images/` and use a relative path such as `assets/images/project-cover.jpg` in the matching JSON entry's `image` field. Leave it blank for the built-in color treatment.
5. Edit `data/resume.json` for the resume summary, experience, education, skills, and PDF link. Set `file` to a local PDF path in `assets/` or a publicly accessible Google Drive share URL. Local PDFs download directly; Drive file links use the download endpoint. Leave `file` blank to hide the button.
6. Replace the sample links, text, dates, and contact details with your own.

Open **Graph** to explore the full portfolio map. **Blog** and **Projects** each use a two-pane workspace, so you can show or minimize the graph and list independently. Search or select a tag to filter both views. Drag graph nodes to rearrange them; node positions are saved in the browser per graph. The layout spaces related nodes and updates their connecting edges as you move them. In **Projects**, mark projects with the `Featured` tag to include them in the featured list and home page, and highlight them in the graph. Project graph tags sit at the center of their clusters, with connected projects arranged around them. Select a project node to open it or a tag node to filter the list and graph. Notes also show backlinks to related notes that share tags.

Markdown supports headings, paragraphs, links, bold and italic text, unordered and ordered lists, blockquotes, and images. For a project image in Markdown, use `![Description](../assets/images/detail.jpg)`.

## Run locally

Serve this folder with any static HTTP server. For example, from the project directory:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Fetching JSON and Markdown requires HTTP; opening `index.html` directly as a file will not work.

## Publish on GitHub Pages

Push this project to GitHub with the default branch named `main`. The included workflow deploys the site on every push. In the repository's **Settings → Pages**, select **GitHub Actions** as the build and deployment source.
