# Portfolio starter

A responsive, Obsidian-inspired portfolio with a linked knowledge graph, graph/list views, light and dark themes, and content kept in JSON and Markdown. Notes and projects connect through shared tags. It uses plain HTML, CSS, and JavaScript, has no build step or runtime dependencies, and can be hosted directly on GitHub Pages. The theme toggle follows the visitor's system preference initially and remembers their choice in the browser.

## Make it yours

1. Edit `data/site.json` with your name, role, location, email, bio, social links, resume, and featured content slugs.
2. Edit `data/projects.json` and `data/posts.json` to add or reorder project and blog cards. Give each entry a `tags` array (for example, `"tags": ["Interface design", "Accessibility"]`). Tags with the same spelling connect notes and projects automatically.
3. Write each project or post in its own Markdown file under `content/projects/` or `content/posts/`.
4. Put images in `assets/images/` and use a relative path such as `assets/images/project-cover.jpg` in the matching JSON entry's `image` field. Leave it blank for the built-in color treatment.
5. Add your downloadable resume to `assets/` and set `resumeFile` in `data/site.json` to its path. Leave the field blank to hide the download button.
6. Replace the sample links, text, dates, and contact details with your own.

Open **Graph** to explore the full portfolio map, or open **Blog** or **Projects** for a collection-specific graph. Use the **Graph / List** switch on each collection page. In graph view, select a note node to open it or select a `#tag` node to filter connected notes. List cards include the same tags; selecting a tag filters the collection. Notes also show backlinks to related notes that share tags.

Markdown supports headings, paragraphs, links, bold and italic text, unordered and ordered lists, blockquotes, and images. For a project image in Markdown, use `![Description](../assets/images/detail.jpg)`.

## Run locally

Serve this folder with any static HTTP server. For example, from the project directory:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Fetching JSON and Markdown requires HTTP; opening `index.html` directly as a file will not work.

## Publish on GitHub Pages

Push this project to GitHub with the default branch named `main`. The included workflow deploys the site on every push. In the repository's **Settings → Pages**, select **GitHub Actions** as the build and deployment source.
