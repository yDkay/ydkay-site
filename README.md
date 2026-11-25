# ydkay.com.br

Site of yDkay (YDKAY TECHNOLOGIES LTDA), the software company of Caio Consoli.
One static page with no build step: HTML, CSS and JavaScript, with a black hole
ray-traced in WebGL behind the content.

| File | What it is |
| --- | --- |
| `index.html` | The page. English text lives here; the Portuguese text is in `main.js`. |
| `styles.css` | Layout, type and the CSS black hole used when WebGL is missing. |
| `blackhole.js` | The WebGL shader (Schwarzschild black hole, accretion disk, stars). |
| `main.js` | Language switch, motion switch, and the scroll-to-distance mapping. |
| `404.html` | Page GitHub Pages serves for unknown paths. |
| `favicon.svg` | The icon: a black hole with a slanted disk. The source for the two files below. |
| `favicon.ico` | The same icon at 16, 32 and 48 px, for browsers that do not take SVG icons. |
| `apple-touch-icon.png` | The icon at 180 px, for the iPhone home screen. |
| `CNAME` | `ydkay.com.br`, the custom domain for GitHub Pages. |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are. |

## Run it locally

```bash
python3 -m http.server 8090 --directory /Users/caioconsoli/Dev/ydkay-site
```

Then open http://localhost:8090. Paths start with `/`, so open the folder as the
server root, not a subfolder. Python's server does not use `404.html`; open
http://localhost:8090/404.html to see it.

## Edit the content

- **A product:** in `index.html`, find `PRODUCT SLOT` and replace the
  "First product" item. Add the Portuguese line to the `PT` object in `main.js`
  if the item has a `data-i18n` key.
- **Links (GitHub, LinkedIn):** find `LINKS SLOT` in `index.html` and uncomment it.
- **Text:** every translated element has a `data-i18n` key; the English is the
  element's text in `index.html`, the Portuguese is the same key in `main.js`.
- **Email:** appears in `index.html` (contact section, footer and the JSON-LD block).

## Motion and accessibility

- The site follows the visitor's "reduce motion" setting. With it on, the black
  hole is a still frame and nothing moves on scroll. The **Motion** button in the
  header overrides it and remembers the choice in the browser.
- Without WebGL, a CSS black hole is shown. Without JavaScript, all text is still there.

## Publish on GitHub Pages

Nothing below has been done yet. Each step is for Caio to do or approve.

1. Create a public repository (for example `yDkay/ydkay-site`) and push this
   folder to its `main` branch.
2. In the repository: **Settings → Pages → Build and deployment → Source:
   Deploy from a branch**, branch `main`, folder `/ (root)`. Save.
3. Optional but recommended, before the custom domain: verify the domain for
   your GitHub account or organization (**Settings → Pages → Add a domain** at
   the account or organization level, not the repository). GitHub gives a TXT
   record named `_github-pages-challenge-<owner>.ydkay.com.br`. Keep it in place.
4. In the repository: **Settings → Pages → Custom domain**: `ydkay.com.br`, Save.
   GitHub asks you to add the domain here before changing DNS.
5. Add the DNS records below in Registro.br.
6. When the DNS check passes, tick **Enforce HTTPS**. The option can take up to
   24 hours to appear while GitHub gets the certificate.

## DNS records for GitHub Pages

Source: GitHub Docs, "Managing a custom domain for your GitHub Pages site",
read on 2026-11-25.

Root domain `ydkay.com.br`:

| Type | Name | Value |
| --- | --- | --- |
| A | (root) | 185.199.108.153 |
| A | (root) | 185.199.109.153 |
| A | (root) | 185.199.110.153 |
| A | (root) | 185.199.111.153 |
| AAAA | (root) | 2606:50c0:8000::153 |
| AAAA | (root) | 2606:50c0:8001::153 |
| AAAA | (root) | 2606:50c0:8002::153 |
| AAAA | (root) | 2606:50c0:8003::153 |

`www.ydkay.com.br`:

| Type | Name | Value |
| --- | --- | --- |
| CNAME | www | `<owner>.github.io` (the GitHub user or organization that owns the repository, without the repository name) |

With both in place, GitHub redirects `www.ydkay.com.br` to `ydkay.com.br`.

Notes:

- **Root in Registro.br:** the panel does not accept `@`. In the advanced DNS
  editor the name field is the part before `.ydkay.com.br`, so for the root it is
  left empty. Registro.br's help pages do not state this; confirm it in the panel.
- Do not add a wildcard record (`*.ydkay.com.br`); GitHub warns it allows domain takeover.
- Remove any default A or AAAA records on the root that point elsewhere.
- Keep the TXT records already there (the domain proof for Anthropic, and GitHub's
  `_github-pages-challenge-…` if you add it).
- Changes can take up to 24 hours to spread.
