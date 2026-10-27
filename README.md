# forgegate

Forge's public site, [forgegate.io](https://forgegate.io): a landing page and
the documentation of [Forge](https://github.com/showmino/forge), built with
[Docusaurus](https://docusaurus.io). Owned by **platform-engineering**.

## Develop

```sh
npm ci
npm start           # http://localhost:3000, reloads on change
npm run typecheck
npm run build       # the static site in build/; fails on a broken link
npm run serve       # serve build/ locally
```

| Path | What |
| --- | --- |
| `docs/` | The documentation. One page per file; the sidebar is `sidebars.ts` |
| `src/pages/index.tsx` | The landing page |
| `src/css/custom.css` | Forge's colors and fonts |
| `static/` | Files served as they are: logo, fonts, `api/healthz`, `robots.txt` |

## Writing Docs

- Every feature of Forge, and every change to what one does, is documented
  here, in the same work as the change in `forge`, `forge-web` or
  `forge-templates`.
- Pages are plain Markdown (`.md`, CommonMark): no MDX and no HTML, so they
  also read well on GitHub. Link to another page by its file
  (`[Addresses](06-addresses.md)`).
- Write for people who run Forge for their own organization: `my-org` for the
  GitHub organization, `example.com` for domains. The real artifacts
  (`ghcr.io/showmino/charts/forge`, the releases of `showmino/forge`) keep
  their names.
- Check the commands against the code. `16-command-reference.md` is the
  output of `forge <command> --help`.
- Add a new page to `sidebars.ts`. Its id is the file name without the
  number prefix (`06-addresses.md` is `addresses`).

## Ship

CI builds every pull request (`npm run build` fails on a broken link). On
`main` it pushes `ghcr.io/showmino/forgegate:<short-sha>`, then deploys that
commit to staging through Forge's public API, logging in with the job's
GitHub OIDC token. The repo is public, so its jobs run on GitHub's runners.

- `forge deploy status forgegate`: what runs where.
- `forge deploy promote forgegate`: staging to production.

The image is nginx serving the static build on port 3000 (`nginx.conf`). In
Forge the root filesystem is read-only, so nginx writes only to `/tmp`. The
health check `/api/healthz` is a static file.
