# forgegate

Owned by **platform-engineering**. Scaffolded by `forge create` from the
`nextjs` template (v1.7.0): a server-rendered
Next.js app with TypeScript and Tailwind CSS.

## Develop

```sh
npm ci
npm run dev        # http://localhost:3000
npm run lint && npm run typecheck && npm test
npm run build      # standalone server in .next/standalone
```

The image runs the standalone server (`node .next/standalone/server.js`); `npm start` (`next start`) warns with standalone output but still serves locally.

## Ship

CI tests every push. On `main` it pushes
`ghcr.io/showmino/forgegate:<short-sha>`, then a `deploy`
job deploys that commit to staging through Forge. It logs in with the job's
GitHub OIDC token, and needs the organization variable `FORGE_API_URL`.

- `forge deploy status forgegate`: what runs where.
- `forge deploy promote forgegate`: staging to production.
- `forge env create <name> --service forgegate --ref <branch>`: a
  preview with its own URL.

Forge versions what it deploys: a release candidate on staging
(`v0.3.1-rc.2`), the final version on production (`v0.3.1`, or
`--bump minor`/`major`), each as a tag and a GitHub release here. The
`release` workflow adds the version to the commit's image.

The server listens on `$PORT` (`run:` in `forge.yaml`). In Forge the root
filesystem is read-only, and Next's cache (`.next/cache`) is a link to the
writable `/tmp`.
